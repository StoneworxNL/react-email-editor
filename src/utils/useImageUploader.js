import { executeAction, isWritable, readString, writeString } from "./mendix";
import { useEffect, useMemo, useRef } from "react";
import { useLatest } from "./useLatest";

const POLL_INTERVAL_MS = 200;

function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
        reader.readAsDataURL(file);
    });
}

// Raster formats only. SVG can carry script: stored and served from the app's
// own domain it would be stored XSS, and Gmail and Outlook do not show it anyway.
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** Refuse files that are not PNG, JPEG, GIF or WebP, or larger than the configured limit. */
export function checkImageFile(file, maxSizeKb) {
    if (!file || !ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw new Error("Only PNG, JPEG, GIF and WebP images can be added to the email.");
    }
    const limit = Number(maxSizeKb);
    if (limit > 0 && file.size > limit * 1024) {
        const sizeKb = Math.round(file.size / 1024);
        throw new Error(`The image is ${sizeKb} KB; the limit is ${limit} KB. Use a smaller or compressed image.`);
    }
}

/** Accept only an absolute https address for "Ask for a URL". */
export function checkImageUrl(value) {
    const text = (value ?? "").trim();
    if (text === "" || text === "https://") {
        throw new Error("No image URL was given.");
    }
    let url;
    try {
        url = new URL(text);
    } catch {
        throw new Error("That is not a valid image URL.");
    }
    if (url.protocol !== "https:") {
        throw new Error("Only https:// image URLs are allowed.");
    }
    return url.href;
}

/** Strip the `data:image/png;base64,` prefix that Mendix does not want. */
function toBase64(dataUrl) {
    const comma = dataUrl.indexOf(",");
    return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

async function uploadViaMicroflow(file, config) {
    const { imageDataAttribute, imageNameAttribute, imageUrlAttribute, onImageUpload } = config;

    if (!isWritable(imageDataAttribute)) {
        throw new Error("Image upload is set to microflow, but the image data attribute is missing or read-only.");
    }
    if (!isWritable(imageUrlAttribute)) {
        // It has to be cleared before each upload: otherwise a URL left from an
        // earlier upload would be taken as the answer to this one.
        throw new Error("Image upload is set to microflow, but the resulting URL attribute is missing or read-only.");
    }

    // Clear the result first so we can wait for it to be filled, and so that
    // uploading the same file twice is still detected as a new result.
    const previousUrl = readString(imageUrlAttribute);
    writeString(imageUrlAttribute, "");

    const dataUrl = await readAsDataUrl(file);
    imageDataAttribute.setValue(toBase64(dataUrl));
    if (isWritable(imageNameAttribute)) {
        imageNameAttribute.setValue(file.name ?? "");
    }

    if (!executeAction(onImageUpload)) {
        throw new Error("The image upload action could not be started.");
    }

    const timeoutMs = Math.max(1, config.timeoutSeconds ?? 30) * 1000;
    const deadline = Date.now() + timeoutMs;

    // Mendix applies the clearing on its next render, so for a moment the old
    // URL can still be read back. Only accept a URL once the cleared value has
    // been seen, or one that differs from the old URL.
    let sawCleared = false;
    // The action runs on the server; when it ends without filling the URL (it
    // failed, or chose not to store the file), say so instead of waiting out
    // the timeout. A couple of polls of grace let the attribute catch up after
    // it was seen running; an action that fails faster than the first poll is
    // never seen running, so allow a little longer for that.
    let sawRunning = false;
    let idlePolls = 0;
    return new Promise((resolve, reject) => {
        const timer = setInterval(() => {
            if (config.isCancelled()) {
                clearInterval(timer);
                reject(new Error("The editor was closed before the upload finished."));
                return;
            }
            const url = readString(config.getLatest().imageUrlAttribute);
            if (url === "") {
                sawCleared = true;
            } else if (sawCleared || url !== previousUrl) {
                clearInterval(timer);
                resolve({ url });
                return;
            }
            const running = Boolean(config.getLatest().onImageUpload?.isExecuting);
            // With waitForUrl the action opens a page (alt text, crop, a library)
            // and the URL is set from there, after the action itself has finished,
            // so only the timeout ends the wait.
            if (!config.waitForUrl) {
                if (running) {
                    sawRunning = true;
                    idlePolls = 0;
                } else if (++idlePolls > (sawRunning ? 2 : 5)) {
                    clearInterval(timer);
                    reject(
                        new Error("The upload action finished without returning an image URL. Check it for errors.")
                    );
                    return;
                }
            }
            if (Date.now() > deadline) {
                clearInterval(timer);
                reject(new Error(`The upload action did not return a URL within ${timeoutMs / 1000} seconds.`));
            }
        }, POLL_INTERVAL_MS);
    });
}

/**
 * Build the `onUploadImage` callback for `<EmailEditor>`.
 *
 * The callback identity only changes when the mode changes: it reads everything
 * else through a ref, so a re-render does not rebuild the image extension and
 * with it the whole editor. Returning `undefined` disables image support
 * entirely, which is what the editor expects when no uploader is given.
 */
export function useImageUploader(config) {
    const latest = useLatest(config);
    // Uploads share one set of attributes, so they take turns: a second image
    // dropped while the first is uploading would otherwise overwrite its data.
    const queueRef = useRef(Promise.resolve());
    const unmountedRef = useRef(false);
    useEffect(() => {
        unmountedRef.current = false;
        return () => {
            unmountedRef.current = true;
        };
    }, []);

    const { mode } = config;

    return useMemo(() => {
        if (mode === "disabled") {
            return undefined;
        }

        return async file => {
            try {
                if (mode === "promptUrl") {
                    // A browser prompt is the whole point of this mode: it is the
                    // no-back-end option for images that are already hosted.
                    // A dropped or pasted file cannot be stored in this mode; say so
                    // rather than dropping it silently.
                    const message = file
                        ? "Image files can't be uploaded here. Enter the https:// URL of a hosted image."
                        : "Enter the https:// URL of a hosted image.";
                    // eslint-disable-next-line no-alert
                    const url = window.prompt(message, "https://");
                    return { url: checkImageUrl(url) };
                }

                checkImageFile(file, latest.current.maxSizeKb);

                if (mode === "microflow") {
                    const upload = queueRef.current.then(() =>
                        uploadViaMicroflow(file, {
                            ...latest.current,
                            getLatest: () => latest.current,
                            isCancelled: () => unmountedRef.current
                        })
                    );
                    // The next upload waits for this one, whether it succeeds or not.
                    queueRef.current = upload.catch(() => undefined);
                    return await upload;
                }

                return { url: await readAsDataUrl(file) };
            } catch (error) {
                latest.current.onError?.(error instanceof Error ? error.message : String(error));
                throw error;
            }
        };
    }, [mode, latest]);
}
