import { fireEvent, render, screen } from "@testing-library/react";
import { posOfType, sampleDoc } from "../__tests__/emailSchema";
import { NodeBreadcrumb } from "./NodeBreadcrumb";

let mockDoc;
let mockSegments = [];

jest.mock("@tiptap/react", () => ({ useCurrentEditor: () => ({ editor: { state: { doc: mockDoc } } }) }));
jest.mock("@react-email/editor/ui", () => ({ Inspector: { Breadcrumb: ({ children }) => children(mockSegments) } }));

function segment(nodeType, pos, nodeAttrs = {}) {
    return { node: { nodeType, nodeAttrs, nodePos: { pos, inside: pos } }, focus: jest.fn() };
}

beforeEach(() => {
    mockDoc = sampleDoc();
});

describe("NodeBreadcrumb", () => {
    it("names every step instead of saying Element", () => {
        mockSegments = [
            segment("body", 0),
            segment("container", posOfType(mockDoc, "container")),
            segment("twoColumns", posOfType(mockDoc, "twoColumns")),
            segment("columnsColumn", posOfType(mockDoc, "columnsColumn", 1))
        ];
        render(<NodeBreadcrumb />);
        expect(screen.getAllByRole("button").map(button => button.textContent)).toEqual([
            "Body",
            "Email",
            "2 columns",
            "Column 2 of 2"
        ]);
        expect(screen.queryByText("Element")).not.toBeInTheDocument();
    });

    it("marks the current block and shows its text", () => {
        mockSegments = [segment("body", 0), segment("paragraph", posOfType(mockDoc, "paragraph"))];
        render(<NodeBreadcrumb />);
        expect(screen.getByRole("button", { name: "Text" })).toHaveAttribute("aria-current", "location");
        expect(screen.getByText(/^“Thank you for your order/)).toBeInTheDocument();
    });

    it("selects an outer block when its step is clicked", () => {
        mockSegments = [segment("body", 0), segment("heading", posOfType(mockDoc, "heading"), { level: 2 })];
        render(<NodeBreadcrumb />);
        fireEvent.click(screen.getByRole("button", { name: "Body" }));
        expect(mockSegments[0].focus).toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Heading 2" })).not.toHaveAttribute("data-clickable");
    });

    it("renders nothing without a selection", () => {
        mockSegments = [];
        const { container } = render(<NodeBreadcrumb />);
        expect(container).toBeEmptyDOMElement();
    });
});
