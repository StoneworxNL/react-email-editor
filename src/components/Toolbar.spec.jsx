import { fireEvent, render, screen } from "@testing-library/react";
import { Toolbar } from "./Toolbar";

function renderToolbar(overrides = {}) {
    const props = {
        view: "design",
        onViewChange: jest.fn(),
        showViewSwitcher: true,
        saveMode: "manual",
        dirty: true,
        saving: false,
        editable: true,
        canUndo: true,
        canRedo: false,
        onUndo: jest.fn(),
        onRedo: jest.fn(),
        onSave: jest.fn(),
        onReload: jest.fn(),
        variables: [],
        onInsertVariable: jest.fn(),
        showInspector: true,
        inspectorOpen: true,
        onToggleInspector: jest.fn(),
        previewWidth: "desktop",
        onPreviewWidthChange: jest.fn(),
        onCopy: jest.fn(),
        copied: false,
        ...overrides
    };
    render(<Toolbar {...props} />);
    return props;
}

describe("Toolbar", () => {
    it("shows that a save is running", () => {
        renderToolbar({ saving: true });
        expect(screen.getByRole("button", { name: "Saving…" })).toBeInTheDocument();
    });

    it("saves only when there is something to save", () => {
        const props = renderToolbar();
        fireEvent.click(screen.getByRole("button", { name: /save/i }));
        expect(props.onSave).toHaveBeenCalled();
    });

    it.each([
        ["nothing changed", { dirty: false }],
        ["a save is running", { saving: true }],
        ["the template is read-only", { editable: false }]
    ])("disables Save when %s", (_label, overrides) => {
        renderToolbar(overrides);
        expect(screen.getByTitle("Save the template (Ctrl+S)")).toBeDisabled();
    });

    it("has no Save button in automatic mode", () => {
        renderToolbar({ saveMode: "auto" });
        expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
    });

    it("shows Send test only when an action is configured", () => {
        renderToolbar();
        expect(screen.queryByRole("button", { name: /send test/i })).not.toBeInTheDocument();
    });

    it("runs Send test with its caption", () => {
        const onSendTest = jest.fn();
        renderToolbar({ onSendTest, sendTestCaption: "Test versturen" });
        fireEvent.click(screen.getByRole("button", { name: "Test versturen" }));
        expect(onSendTest).toHaveBeenCalled();
    });

    it("disables Send test while it cannot run", () => {
        renderToolbar({ onSendTest: jest.fn(), sendTestCaption: "Send test", sendTestDisabled: true });
        expect(screen.getByRole("button", { name: "Send test" })).toBeDisabled();
    });

    it("switches views", () => {
        const props = renderToolbar();
        fireEvent.click(screen.getByRole("button", { name: "Preview" }));
        expect(props.onViewChange).toHaveBeenCalledWith("preview");
        expect(screen.getByRole("button", { name: "Design" })).toHaveAttribute("aria-pressed", "true");
    });

    it("offers undo and redo only in the design view, as far as possible", () => {
        renderToolbar();
        expect(screen.getByTitle("Undo")).toBeEnabled();
        expect(screen.getByTitle("Redo")).toBeDisabled();
    });

    it("offers copy in the code views", () => {
        const props = renderToolbar({ view: "html" });
        expect(screen.queryByTitle("Undo")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Copy" }));
        expect(props.onCopy).toHaveBeenCalled();
    });

    it("switches the preview width", () => {
        const props = renderToolbar({ view: "preview" });
        fireEvent.click(screen.getByTitle("Mobile width"));
        expect(props.onPreviewWidthChange).toHaveBeenCalledWith("mobile");
    });
});
