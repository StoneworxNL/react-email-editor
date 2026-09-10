import { executeAction, isWritable, readString, writeString } from "./mendix";
import { useMemo, useRef } from "react";

const POLL_INTERVAL_MS = 200;

function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
        reader.readAsDataURL(file);
    });
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
    if (!imageUrlAttribute) {
        throw new Error("Image upload is set to microflow, but the resulting URL attribute is not configured.");
    }

    // Clear the result first so we can wait for it to be filled, and so that
    // uploading the same file twice is still detected as a new result.
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

    return new Promise((resolve, reject) => {
        const timer = setInterval(() => {
            const url = readString(config.getLatest().imageUrlAttribute);
            if (url !== "") {
                clearInterval(timer);
                resolve({ url });
                return;
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
    const latest = useRef(config);
    latest.current = config;

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
                    // eslint-disable-next-line no-alert
                    const url = window.prompt("Image URL", "https://");
                    if (!url || url.trim() === "" || url.trim() === "https://") {
                        throw new Error("No image URL was given.");
                    }
                    return { url: url.trim() };
                }

                if (mode === "microflow") {
                    return await uploadViaMicroflow(file, {
                        ...latest.current,
                        getLatest: () => latest.current
                    });
                }

                return { url: await readAsDataUrl(file) };
            } catch (error) {
                latest.current.onError?.(error instanceof Error ? error.message : String(error));
                throw error;
            }
        };
    }, [mode]);
}
