import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { action, attribute, datasource, listAttribute } from "../__tests__/mendixMocks";
import { EmailTemplateEditor } from "./EmailTemplateEditor";

// The real editor needs a browser layout engine; the widget only talks to it
// through props and the ref it hands to onReady, so stand in for exactly that.
let mockEditorProps;
let mockRef;

jest.mock("@react-email/editor", () => {
    const { useEffect } = jest.requireActual("react");
    function EmailEditor(props) {
        mockEditorProps = props;
        useEffect(() => {
            props.onReady(mockRef);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);
        return <div data-testid="surface">{JSON.stringify(props.content ?? null)}</div>;
    }
    return { EmailEditor };
});

jest.mock("@tiptap/react", () => ({ useCurrentEditor: () => ({ editor: null }) }));

jest.mock("@react-email/editor/ui", () => {
    const Pass = ({ children }) => <div>{children}</div>;
    const Nothing = () => null;
    return { Inspector: { Root: Pass, Breadcrumb: Nothing, Document: Nothing, Node: Nothing, Text: Nothing } };
});

const DOC = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }] };
const EDITED = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };

function createFakeRef(initialDoc) {
    const calls = [];
    const chain = {
        focus: jest.fn(() => {
            calls.push(["focus"]);
            return chain;
        }),
        insertContent: jest.fn(content => {
            calls.push(["insertContent", content]);
            return chain;
        }),
        insertContentAt: jest.fn((range, content) => {
            calls.push(["insertContentAt", range, content]);
            return chain;
        }),
        undo: jest.fn(() => chain),
        redo: jest.fn(() => chain),
        run: jest.fn(() => true)
    };
    const listeners = {};
    const editor = {
        isFocused: false,
        isEditable: true,
        state: { selection: { from: 1, to: 1 }, doc: { content: { size: 20 } } },
        chain: () => chain,
        can: () => ({ undo: () => true, redo: () => false }),
        on: (name, fn) => {
            listeners[name] = fn;
        },
        off: name => {
            delete listeners[name];
        },
        setEditable: jest.fn(value => {
            editor.isEditable = value;
        }),
        emit: name => listeners[name]?.()
    };
    const ref = {
        doc: initialDoc,
        editor,
        calls,
        getJSON: () => ref.doc,
        getEmail: jest.fn(() => Promise.resolve({ html: `<p>${JSON.stringify(ref.doc)}</p>`, text: "plain text" }))
    };
    return ref;
}

function makeProps(overrides = {}) {
    return {
        documentAttribute: attribute(JSON.stringify(DOC)),
        htmlAttribute: attribute(""),
        textAttribute: attribute(""),
        subjectAttribute: attribute("Order {%OrderNumber%}"),
        saveMode: "manual",
        autoSaveDelay: 800,
        warnOnUnsavedChanges: false,
        showToolbar: true,
        showViewSwitcher: true,
        showInspector: true,
        heightMode: "fixed",
        heightValue: 600,
        themePreset: "basic",
        imageMode: "dataUrl",
        variablePrefix: "{%",
        variableSuffix: "%}",
        onSaveAction: action(),
        ...overrides
    };
}

function edit(doc = EDITED) {
    mockRef.doc = doc;
    act(() => mockEditorProps.onUpdate(mockRef));
}

beforeEach(() => {
    mockRef = createFakeRef(DOC);
    mockEditorProps = undefined;
});

describe("EmailTemplateEditor", () => {
    it("loads the stored document into the editor", async () => {
        render(<EmailTemplateEditor {...makeProps()} />);
        expect(await screen.findByTestId("surface")).toHaveTextContent('"text":"Hi"');
        expect(screen.getByText("No changes")).toBeInTheDocument();
    });

    it("imports the HTML when there is no document", async () => {
        const props = makeProps({ documentAttribute: attribute(""), htmlAttribute: attribute("<p>legacy</p>") });
        render(<EmailTemplateEditor {...props} />);
        expect(await screen.findByTestId("surface")).toHaveTextContent("<p>legacy</p>");
    });

    it("saves the document, HTML, text and subject, then runs On save", async () => {
        const props = makeProps();
        render(<EmailTemplateEditor {...props} />);
        await screen.findByTestId("surface");

        edit();
        expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /save/i }));
        await waitFor(() => expect(props.onSaveAction.execute).toHaveBeenCalledTimes(1));

        expect(JSON.parse(props.documentAttribute.value)).toEqual(EDITED);
        expect(props.htmlAttribute.value).toContain("Hello");
        expect(props.textAttribute.value).toBe("plain text");
        expect(props.subjectAttribute.setValue).not.toHaveBeenCalled();
        expect(await screen.findByText(/Saved at/)).toBeInTheDocument();
    });

    it("saves with Ctrl+S", async () => {
        const props = makeProps();
        const { container } = render(<EmailTemplateEditor {...props} />);
        await screen.findByTestId("surface");
        edit();
        fireEvent.keyDown(container.firstChild, { key: "s", ctrlKey: true });
        await waitFor(() => expect(props.onSaveAction.execute).toHaveBeenCalled());
    });

    it("saves an edited subject", async () => {
        const props = makeProps();
        render(<EmailTemplateEditor {...props} />);
        await screen.findByTestId("surface");

        fireEvent.change(screen.getByPlaceholderText("Email subject"), { target: { value: "New subject" } });
        fireEvent.click(screen.getByRole("button", { name: /save/i }));
        await waitFor(() => expect(props.subjectAttribute.value).toBe("New subject"));
    });

    it("saves automatically after the change delay and then runs On change", async () => {
        jest.useFakeTimers();
        try {
            const props = makeProps({ saveMode: "auto", autoSaveDelay: 500, onChangeAction: action() });
            render(<EmailTemplateEditor {...props} />);
            await act(async () => {});
            edit();
            expect(props.onSaveAction.execute).not.toHaveBeenCalled();
            await act(async () => {
                await jest.advanceTimersByTimeAsync(600);
            });
            expect(props.onSaveAction.execute).toHaveBeenCalledTimes(1);
            expect(props.onChangeAction.execute).toHaveBeenCalledTimes(1);
            expect(JSON.parse(props.documentAttribute.value)).toEqual(EDITED);
        } finally {
            jest.useRealTimers();
        }
    });

    describe("Send test", () => {
        it("is hidden without an action", async () => {
            render(<EmailTemplateEditor {...makeProps()} />);
            await screen.findByTestId("surface");
            expect(screen.queryByRole("button", { name: /send test/i })).not.toBeInTheDocument();
        });

        it("writes the current template without On save, then runs the action", async () => {
            const onSendTestAction = action();
            const props = makeProps({ onSendTestAction, sendTestCaption: { value: "Send test" } });
            render(<EmailTemplateEditor {...props} />);
            await screen.findByTestId("surface");
            edit();

            fireEvent.click(screen.getByRole("button", { name: "Send test" }));
            await waitFor(() => expect(onSendTestAction.execute).toHaveBeenCalledTimes(1));
            expect(JSON.parse(props.documentAttribute.value)).toEqual(EDITED);
            expect(props.onSaveAction.execute).not.toHaveBeenCalled();
        });

        it("falls back to its default caption", async () => {
            render(<EmailTemplateEditor {...makeProps({ onSendTestAction: action() })} />);
            expect(await screen.findByRole("button", { name: "Send test" })).toBeInTheDocument();
        });

        it("is disabled while the action cannot run", async () => {
            render(<EmailTemplateEditor {...makeProps({ onSendTestAction: action({ canExecute: false }) })} />);
            expect(await screen.findByRole("button", { name: "Send test" })).toBeDisabled();
        });
    });

    describe("variables", () => {
        const variableProps = () =>
            makeProps({
                variablesDatasource: datasource(["v1"]),
                variableToken: listAttribute({ v1: "{%LastName%}" }),
                variableLabel: listAttribute({ v1: "Last name" }),
                variableSample: listAttribute({ v1: "Lovelace" })
            });

        function insertLastName() {
            fireEvent.click(screen.getByRole("button", { name: /variable/i }));
            fireEvent.click(screen.getByRole("menuitem", { name: /last name/i }));
        }

        it("inserts at the place the user was last typing", async () => {
            render(<EmailTemplateEditor {...variableProps()} />);
            await screen.findByTestId("surface");

            mockRef.editor.isFocused = true;
            mockRef.editor.state.selection = { from: 7, to: 7 };
            act(() => mockRef.editor.emit("transaction"));
            mockRef.editor.isFocused = false;
            mockRef.editor.state.selection = { from: 1, to: 1 };

            insertLastName();
            expect(mockRef.calls).toContainEqual(["insertContentAt", { from: 7, to: 7 }, "{%LastName%}"]);
        });

        it("inserts at the editor's own selection when nothing was remembered", async () => {
            render(<EmailTemplateEditor {...variableProps()} />);
            await screen.findByTestId("surface");
            insertLastName();
            expect(mockRef.calls).toContainEqual(["insertContent", "{%LastName%}"]);
        });

        it("does not insert past the end of a document that shrank", async () => {
            render(<EmailTemplateEditor {...variableProps()} />);
            await screen.findByTestId("surface");

            mockRef.editor.isFocused = true;
            mockRef.editor.state.selection = { from: 18, to: 18 };
            act(() => mockRef.editor.emit("transaction"));
            mockRef.editor.state.doc.content.size = 4;

            insertLastName();
            expect(mockRef.calls).toContainEqual(["insertContent", "{%LastName%}"]);
        });

        it("fills in sample values in the preview only", async () => {
            mockRef.getEmail = jest.fn(() => Promise.resolve({ html: "<p>Dear {%LastName%}</p>", text: "" }));
            render(<EmailTemplateEditor {...variableProps()} />);
            await screen.findByTestId("surface");

            fireEvent.click(screen.getByRole("button", { name: "Preview" }));
            await waitFor(() =>
                expect(document.querySelector("iframe")?.getAttribute("srcdoc") ?? "").toContain("Dear Lovelace")
            );
            expect(screen.getByText("1 variable")).toBeInTheDocument();
        });
    });

    it("warns instead of overwriting unsaved work when the template changes elsewhere", async () => {
        const props = makeProps();
        const { rerender } = render(<EmailTemplateEditor {...props} />);
        await screen.findByTestId("surface");
        edit();

        const other = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Theirs" }] }] };
        rerender(<EmailTemplateEditor {...props} documentAttribute={attribute(JSON.stringify(other))} />);

        expect(await screen.findByText(/changed elsewhere/)).toBeInTheDocument();
        expect(screen.getByTestId("surface")).toHaveTextContent('"text":"Hi"');

        fireEvent.click(screen.getByRole("button", { name: "Load the other version" }));
        expect(await screen.findByTestId("surface")).toHaveTextContent("Theirs");
    });

    it("does not treat its own save coming back as an outside change", async () => {
        const props = makeProps();
        const { rerender } = render(<EmailTemplateEditor {...props} />);
        await screen.findByTestId("surface");
        edit();
        fireEvent.click(screen.getByRole("button", { name: /save/i }));
        await waitFor(() => expect(props.onSaveAction.execute).toHaveBeenCalled());

        rerender(<EmailTemplateEditor {...props} documentAttribute={attribute(props.documentAttribute.value)} />);
        expect(screen.queryByText(/changed elsewhere/)).not.toBeInTheDocument();
        expect(mockEditorProps.content).toEqual(DOC);
    });

    describe("style panel", () => {
        const originalWidth = window.innerWidth;
        afterEach(() => {
            window.innerWidth = originalWidth;
        });

        it("starts open on a wide screen", async () => {
            window.innerWidth = 1280;
            render(<EmailTemplateEditor {...makeProps()} />);
            expect(await screen.findByTitle("Hide the style panel")).toHaveAttribute("aria-pressed", "true");
        });

        it("starts open when the width is not known yet", async () => {
            window.innerWidth = 0;
            render(<EmailTemplateEditor {...makeProps()} />);
            expect(await screen.findByTitle("Hide the style panel")).toHaveAttribute("aria-pressed", "true");
        });

        it("starts closed on a phone, and can still be opened", async () => {
            window.innerWidth = 375;
            render(<EmailTemplateEditor {...makeProps()} />);
            const toggle = await screen.findByTitle("Show the style panel");
            expect(toggle).toHaveAttribute("aria-pressed", "false");
            fireEvent.click(toggle);
            expect(screen.getByTitle("Hide the style panel")).toHaveAttribute("aria-pressed", "true");
        });
    });

    it("keeps edits made while a save was rendering marked as unsaved", async () => {
        const props = makeProps();
        let finishRender;
        mockRef.getEmail = jest.fn(
            () =>
                new Promise(resolve => {
                    finishRender = () => resolve({ html: "<p>Hello</p>", text: "Hello" });
                })
        );
        render(<EmailTemplateEditor {...props} />);
        await screen.findByTestId("surface");
        edit();

        fireEvent.click(screen.getByRole("button", { name: /save/i }));
        // The user keeps typing while React Email renders the email.
        const later = {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Hello again" }] }]
        };
        mockRef.doc = later;
        await act(async () => {
            finishRender();
            await Promise.resolve();
        });

        expect(JSON.parse(props.documentAttribute.value)).toEqual(EDITED);
        expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });

    it("does not save automatically over a version changed elsewhere", async () => {
        jest.useFakeTimers();
        try {
            const props = makeProps({ saveMode: "auto", autoSaveDelay: 500 });
            const { rerender } = render(<EmailTemplateEditor {...props} />);
            await act(async () => {});
            edit();

            const other = {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Theirs" }] }]
            };
            const theirs = attribute(JSON.stringify(other));
            rerender(<EmailTemplateEditor {...props} documentAttribute={theirs} />);
            await act(async () => {
                await jest.advanceTimersByTimeAsync(2000);
            });

            expect(screen.getByText(/changed elsewhere/)).toBeInTheDocument();
            expect(theirs.setValue).not.toHaveBeenCalled();
            expect(props.onSaveAction.execute).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });

    it("saves after Keep my changes in automatic mode", async () => {
        jest.useFakeTimers();
        try {
            const props = makeProps({ saveMode: "auto", autoSaveDelay: 500 });
            const { rerender } = render(<EmailTemplateEditor {...props} />);
            await act(async () => {});
            edit();
            const other = {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Theirs" }] }]
            };
            const theirs = attribute(JSON.stringify(other));
            rerender(<EmailTemplateEditor {...props} documentAttribute={theirs} />);
            await act(async () => {});

            fireEvent.click(screen.getByRole("button", { name: "Keep my changes" }));
            await act(async () => {
                await jest.advanceTimersByTimeAsync(600);
            });
            expect(JSON.parse(theirs.value)).toEqual(EDITED);
            expect(props.onSaveAction.execute).toHaveBeenCalledTimes(1);
        } finally {
            jest.useRealTimers();
        }
    });

    it("does not write an automatic save that was rendering when the template changed elsewhere", async () => {
        jest.useFakeTimers();
        try {
            let finishRender;
            mockRef.getEmail = jest.fn(
                () =>
                    new Promise(resolve => {
                        finishRender = () => resolve({ html: "<p>Hello</p>", text: "Hello" });
                    })
            );
            const props = makeProps({ saveMode: "auto", autoSaveDelay: 500 });
            const { rerender } = render(<EmailTemplateEditor {...props} />);
            await act(async () => {});
            edit();
            await act(async () => {
                await jest.advanceTimersByTimeAsync(600);
            });
            // The automatic save is rendering; now someone else saves.
            const other = {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Theirs" }] }]
            };
            const theirs = attribute(JSON.stringify(other));
            rerender(<EmailTemplateEditor {...props} documentAttribute={theirs} />);
            await act(async () => {
                finishRender();
                await Promise.resolve();
            });

            expect(theirs.setValue).not.toHaveBeenCalled();
            expect(props.onSaveAction.execute).not.toHaveBeenCalled();
            expect(screen.getByText(/changed elsewhere/)).toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
    });

    it("asks before a reload throws away unsaved work", async () => {
        render(<EmailTemplateEditor {...makeProps()} />);
        await screen.findByTestId("surface");
        edit();
        fireEvent.click(screen.getByRole("button", { name: /reload/i }));
        expect(screen.getByText(/unsaved changes will be lost/)).toBeInTheDocument();
    });

    it("is read-only when the storage attribute is", async () => {
        const readOnly = attribute(JSON.stringify(DOC), { readOnly: true });
        render(<EmailTemplateEditor {...makeProps({ documentAttribute: readOnly })} />);
        await screen.findByTestId("surface");
        expect(screen.getByText("Read-only")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
        expect(mockRef.editor.setEditable).toHaveBeenCalledWith(false);
    });

    it("shows a broken custom theme instead of failing", async () => {
        render(<EmailTemplateEditor {...makeProps({ themePreset: "custom", themeConfig: "{oops" })} />);
        expect(await screen.findByRole("alert")).toHaveTextContent("not valid JSON");
    });
});
