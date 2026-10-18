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
