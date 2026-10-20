import { action, attribute } from "../__tests__/mendixMocks";
import { renderHook } from "@testing-library/react";
import { useImageUploader } from "./useImageUploader";

const file = new File(["png-bytes"], "logo.png", { type: "image/png" });

function setup(config) {
    const onError = jest.fn();
    const hook = renderHook(props => useImageUploader(props), { initialProps: { onError, ...config } });
    return { ...hook, onError };
}

describe("useImageUploader", () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it("disables images entirely", () => {
        expect(setup({ mode: "disabled" }).result.current).toBeUndefined();
    });

    it("embeds a data URL", async () => {
        const { result } = setup({ mode: "dataUrl" });
        const { url } = await result.current(file);
        expect(url).toMatch(/^data:image\/png;base64,/);
    });

    it("asks for a URL and trims it", async () => {
        jest.spyOn(window, "prompt").mockReturnValue("  https://cdn.example.com/a.png ");
        const { result } = setup({ mode: "promptUrl" });
        await expect(result.current(file)).resolves.toEqual({ url: "https://cdn.example.com/a.png" });
    });

    it.each([
        ["http://cdn.example.com/a.png", "Only https:// image URLs are allowed."],
        // Built up so the linter does not take the test value for a script URL.
        [["javascript", "alert(1)"].join(":"), "Only https:// image URLs are allowed."],
        ["data:image/png;base64,AAAA", "Only https:// image URLs are allowed."],
        ["not a url", "That is not a valid image URL."]
    ])("refuses %s in Ask for a URL", async (given, message) => {
        jest.spyOn(window, "prompt").mockReturnValue(given);
        const { result } = setup({ mode: "promptUrl" });
        await expect(result.current(file)).rejects.toThrow(message);
    });

    it("refuses images over the size limit", async () => {
        const big = new File([new Uint8Array(3 * 1024)], "big.png", { type: "image/png" });
        const { result, onError } = setup({ mode: "dataUrl", maxSizeKb: 2 });
        await expect(result.current(big)).rejects.toThrow("The image is 3 KB; the limit is 2 KB.");
        expect(onError).toHaveBeenCalled();
    });

    it("refuses files that are not images", async () => {
        const pdf = new File(["%PDF"], "doc.pdf", { type: "application/pdf" });
        const { result } = setup({ mode: "dataUrl", maxSizeKb: 2048 });
        await expect(result.current(pdf)).rejects.toThrow("Only image files can be added to the email.");
    });

    it("has no size limit at 0", async () => {
        const big = new File([new Uint8Array(3 * 1024)], "big.png", { type: "image/png" });
        const { result } = setup({ mode: "dataUrl", maxSizeKb: 0 });
        await expect(result.current(big)).resolves.toEqual({ url: expect.stringMatching(/^data:image\/png/) });
    });

    it("reports a cancelled URL prompt", async () => {
        jest.spyOn(window, "prompt").mockReturnValue("https://");
        const { result, onError } = setup({ mode: "promptUrl" });
        await expect(result.current(file)).rejects.toThrow("No image URL was given.");
        expect(onError).toHaveBeenCalledWith("No image URL was given.");
    });

    it("keeps the same callback across renders until the mode changes", () => {
        const { result, rerender, onError } = setup({ mode: "dataUrl" });
        const first = result.current;
        rerender({ mode: "dataUrl", onError, timeoutSeconds: 5 });
        expect(result.current).toBe(first);
        rerender({ mode: "promptUrl", onError });
        expect(result.current).not.toBe(first);
    });

    describe("microflow mode", () => {
        it("writes the file, runs the action and waits for the URL", async () => {
            const data = attribute("");
            const name = attribute("");
            const url = attribute("old-url");
            const upload = action();
            const { result } = setup({
                mode: "microflow",
                imageDataAttribute: data,
                imageNameAttribute: name,
                imageUrlAttribute: url,
                onImageUpload: upload
            });

            const finishUpload = () => url.setValue("https://files.example.com/logo.png");
            upload.execute.mockImplementation(() => setTimeout(finishUpload, 50));

            await expect(result.current(file)).resolves.toEqual({ url: "https://files.example.com/logo.png" });
            expect(data.setValue).toHaveBeenCalledWith(btoa("png-bytes"));
            expect(name.setValue).toHaveBeenCalledWith("logo.png");
            // The old URL is cleared first, so a repeat upload is still noticed.
            expect(url.setValue).toHaveBeenNthCalledWith(1, "");
        });

        it("does not take the previous image's URL, still readable before Mendix re-renders, as the answer", async () => {
            const url = attribute("https://files.example.com/old.png");
            // The clearing write is not visible yet: reads still return the old URL.
            url.setValue.mockImplementation(() => undefined);
            const upload = action();
            upload.execute.mockImplementation(() => {
                upload.isExecuting = true;
                setTimeout(() => {
                    url.value = "https://files.example.com/new.png";
                    upload.isExecuting = false;
                }, 300);
            });
            const { result } = setup({
                mode: "microflow",
                imageDataAttribute: attribute(""),
                imageUrlAttribute: url,
                onImageUpload: upload
            });
            await expect(result.current(file)).resolves.toEqual({ url: "https://files.example.com/new.png" });
        });

        it("gives up after the timeout", async () => {
            // An action that keeps running and never fills the URL.
            const stuck = action();
            stuck.execute.mockImplementation(() => {
                stuck.isExecuting = true;
            });
            const { result, onError } = setup({
                mode: "microflow",
                imageDataAttribute: attribute(""),
                imageUrlAttribute: attribute(""),
                onImageUpload: stuck,
                timeoutSeconds: 1
            });
            await expect(result.current(file)).rejects.toThrow("did not return a URL within 1 seconds");
            expect(onError).toHaveBeenCalled();
        });

        it("refuses a read-only URL attribute, whose old value would be taken as the answer", async () => {
            const { result } = setup({
                mode: "microflow",
                imageDataAttribute: attribute(""),
                imageUrlAttribute: attribute("https://old.example.com/a.png", { readOnly: true }),
                onImageUpload: action()
            });
            await expect(result.current(file)).rejects.toThrow("URL attribute is missing or read-only");
        });

        it("runs uploads one after the other", async () => {
            const data = attribute("");
            const url = attribute("");
            const upload = action();
            const order = [];
            upload.execute.mockImplementation(() => {
                order.push(`start ${data.value.length}`);
                const finish = () => {
                    order.push("finish");
                    url.setValue(`https://files.example.com/${order.length}.png`);
                };
                setTimeout(finish, 30);
            });
            const { result } = setup({
                mode: "microflow",
                imageDataAttribute: data,
                imageUrlAttribute: url,
                onImageUpload: upload
            });

            const first = result.current(new File(["a"], "a.png", { type: "image/png" }));
            const second = result.current(new File(["bbbb"], "b.png", { type: "image/png" }));
            await Promise.all([first, second]);
            expect(order).toEqual(["start 4", "finish", "start 8", "finish"]);
        });

        it("stops waiting when the editor goes away", async () => {
            const { result, unmount } = setup({
                mode: "microflow",
                imageDataAttribute: attribute(""),
                imageUrlAttribute: attribute(""),
                onImageUpload: action(),
                timeoutSeconds: 30
            });
            const pending = result.current(file);
            unmount();
            await expect(pending).rejects.toThrow("closed before the upload finished");
        });

        it("stops waiting when the upload action ends without a URL", async () => {
            const upload = action();
            upload.execute.mockImplementation(() => {
                upload.isExecuting = true;
                setTimeout(() => {
                    upload.isExecuting = false;
                }, 100);
            });
            const { result } = setup({
                mode: "microflow",
                imageDataAttribute: attribute(""),
                imageUrlAttribute: attribute(""),
                onImageUpload: upload,
                timeoutSeconds: 30
            });
            const started = Date.now();
            await expect(result.current(file)).rejects.toThrow("finished without returning an image URL");
            expect(Date.now() - started).toBeLessThan(3000);
        });

        it("explains a missing configuration", async () => {
            const { result } = setup({ mode: "microflow", imageDataAttribute: attribute("", { readOnly: true }) });
            await expect(result.current(file)).rejects.toThrow("missing or read-only");
        });

        it("explains an action that cannot run", async () => {
            const { result } = setup({
                mode: "microflow",
                imageDataAttribute: attribute(""),
                imageUrlAttribute: attribute(""),
                onImageUpload: action({ canExecute: false })
            });
            await expect(result.current(file)).rejects.toThrow("could not be started");
        });
    });
});
