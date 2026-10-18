import { fireEvent, render, screen } from "@testing-library/react";
import { VariableMenu } from "./VariableMenu";

const variables = [
    { id: "1", label: "First name", token: "{%FirstName%}" },
    { id: "2", label: "Last name", token: "{%LastName%}" }
];

describe("VariableMenu", () => {
    it("renders nothing without variables", () => {
        const { container } = render(<VariableMenu onInsert={jest.fn()} variables={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("lists each variable with the token it will insert", () => {
        render(<VariableMenu onInsert={jest.fn()} variables={variables} />);
        fireEvent.click(screen.getByRole("button", { name: /variable/i }));
        expect(screen.getAllByRole("menuitem")).toHaveLength(2);
        expect(screen.getByText("{%LastName%}")).toBeInTheDocument();
    });

    it("inserts the chosen variable and closes", () => {
        const onInsert = jest.fn();
        render(<VariableMenu onInsert={onInsert} variables={variables} />);
        fireEvent.click(screen.getByRole("button", { name: /variable/i }));
        fireEvent.click(screen.getByRole("menuitem", { name: /last name/i }));
        expect(onInsert).toHaveBeenCalledWith(variables[1]);
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("closes on Escape and on a click elsewhere", () => {
        render(
            <div>
                <VariableMenu onInsert={jest.fn()} variables={variables} />
                <p>outside</p>
            </div>
        );
        const toggle = screen.getByRole("button", { name: /variable/i });

        fireEvent.click(toggle);
        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();

        fireEvent.click(toggle);
        fireEvent.pointerDown(screen.getByText("outside"));
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("can be disabled", () => {
        render(<VariableMenu disabled onInsert={jest.fn()} variables={variables} />);
        expect(screen.getByRole("button", { name: /variable/i })).toBeDisabled();
    });
});
