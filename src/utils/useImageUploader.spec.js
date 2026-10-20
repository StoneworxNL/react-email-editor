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
            upload.execute.mockImplementation(() =>
                setTimeout(() => {
                    url.value = "https://files.example.com/new.png";
                }, 300)
            );
            const { result } = setup({
                mode: "microflow",
                imageDataAttribute: attribute(""),
                imageUrlAttribute: url,
                onImageUpload: upload
            });
            await expect(result.current(file)).resolves.toEqual({ url: "https://files.example.com/new.png" });
        });

        it("gives up after the timeout", async () => {
            const { result, onError } = setup({
                mode: "microflow",
                imageDataAttribute: attribute(""),
                imageUrlAttribute: attribute(""),
                onImageUpload: action(),
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
