import { AlertIcon, CheckIcon } from "./Icons";
import { allSettled, executeAction, isAvailable, isWritable, readString, writeString } from "../utils/mendix";
import { readVariables, resolveSource, serializeDocument, substituteVariables } from "../utils/template";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodePane } from "./CodePane";
import { EmailEditor } from "@react-email/editor";
import { Inspector } from "@react-email/editor/ui";
import { NodeBreadcrumb } from "./NodeBreadcrumb";
import { PreviewPane } from "./PreviewPane";
import { SelectionHighlight } from "./SelectionHighlight";
import { Toolbar } from "./Toolbar";
import classNames from "classnames";
import { resolveTheme } from "../utils/theme";
import { useImageUploader } from "../utils/useImageUploader";
import { useLatest } from "../utils/useLatest";

/** Matches the narrow-layout container query in ReactEmail.css. */
const NARROW_VIEWPORT = 720;

function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function EmailTemplateEditor(props) {
    const {
        documentAttribute,
        htmlAttribute,
        textAttribute,
        subjectAttribute,
        saveMode,
        autoSaveDelay,
        placeholderText,
        warnOnUnsavedChanges,
        showToolbar,
        showViewSwitcher,
        showInspector,
        heightMode,
        heightValue,
        themePreset,
        themeConfig,
        variablesDatasource,
        variableName,
        variableToken,
        variableLabel,
        variableSample,
        variablePrefix,
        variableSuffix,
        imageMode,
        onSaveAction,
        onChangeAction,
        onSendTestAction,
        sendTestCaption
    } = props;

    const [loaded, setLoaded] = useState(null);
    const [emailRef, setEmailRef] = useState(null);
    const [docDirty, setDocDirty] = useState(false);
    const [subjectDraft, setSubjectDraft] = useState(null);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState(null);
    const [error, setError] = useState(null);
    const [externalChange, setExternalChange] = useState(false);
    const [view, setView] = useState("design");
    const [previewWidth, setPreviewWidth] = useState("desktop");
    // On a phone the style panel would take most of the editor, so it starts closed there.
    // A width of 0 means the page is not laid out yet (a hidden frame): assume a wide screen.
    const [inspectorOpen, setInspectorOpen] = useState(
        () => !(window.innerWidth > 0 && window.innerWidth <= NARROW_VIEWPORT)
    );
    const [composed, setComposed] = useState(null);
    const [copied, setCopied] = useState(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [confirmReload, setConfirmReload] = useState(false);

    const rootRef = useRef(null);
    const loadKeyRef = useRef(0);
    const baselineRef = useRef("");
    const lastHtmlRef = useRef(null);
    const loadedSignatureRef = useRef(null);
    const saveSequenceRef = useRef(0);
    const idleTimerRef = useRef(null);
    const selectionRef = useRef(null);

    // ---------------------------------------------------------------- sources

    const documentRaw = readString(documentAttribute);
    const htmlRaw = readString(htmlAttribute);
    const subjectRaw = readString(subjectAttribute);

    const ready =
        allSettled([documentAttribute, htmlAttribute, textAttribute, subjectAttribute]) &&
        (isAvailable(documentAttribute) || isAvailable(htmlAttribute));

    const source = useMemo(() => resolveSource(documentRaw, htmlRaw), [documentRaw, htmlRaw]);

    const storageAttribute = documentAttribute ?? htmlAttribute;
    const editable = ready && isWritable(storageAttribute);

    const subject = subjectDraft ?? subjectRaw;
    const subjectDirty = subjectDraft !== null && subjectDraft !== subjectRaw;
    const dirty = docDirty || subjectDirty;

    const dirtyRef = useLatest(dirty);
    const subjectRef = useLatest(subject);

    // ------------------------------------------------------------- appearance

    const { theme, error: themeError } = useMemo(
        () => resolveTheme(themePreset, themeConfig),
        [themePreset, themeConfig]
    );

    const variables = useMemo(
        () =>
            readVariables(
                variablesDatasource,
                { name: variableName, token: variableToken, label: variableLabel, sample: variableSample },
                variablePrefix,
                variableSuffix
            ),
        [
            variablesDatasource,
            variableName,
            variableToken,
            variableLabel,
            variableSample,
            variablePrefix,
            variableSuffix
        ]
    );

    const uploadImage = useImageUploader({
        mode: imageMode,
        imageDataAttribute: props.imageDataAttribute,
        imageNameAttribute: props.imageNameAttribute,
        imageUrlAttribute: props.imageUrlAttribute,
        onImageUpload: props.onImageUpload,
        timeoutSeconds: props.imageUploadTimeout,
        onError: setError
    });

    // ----------------------------------------------------------------- saving

    const persist = useCallback(
        async ({ runSaveAction }) => {
            const ref = emailRef;
            if (!ref?.editor || !editable) {
                return false;
            }
            const sequence = ++saveSequenceRef.current;
            setSaving(true);
            setError(null);
            try {
                const documentJson = serializeDocument(ref.getJSON());
                const { html, text } = await ref.getEmail();
                if (sequence !== saveSequenceRef.current) {
                    // A newer save started while react-email was rendering.
                    return false;
                }

                writeString(documentAttribute, documentJson);
                writeString(htmlAttribute, html);
                writeString(textAttribute, text);
                writeString(subjectAttribute, subjectRef.current);

                baselineRef.current = documentJson;
                lastHtmlRef.current = html;
                setDocDirty(false);
                setSubjectDraft(null);
                setExternalChange(false);
                setSavedAt(new Date());

                if (runSaveAction) {
                    executeAction(onSaveAction);
                }
                return true;
            } catch (caught) {
                setError(`The template could not be saved: ${errorMessage(caught)}`);
                return false;
            } finally {
                if (sequence === saveSequenceRef.current) {
                    setSaving(false);
                }
            }
        },
        [
            emailRef,
            editable,
            documentAttribute,
            htmlAttribute,
            textAttribute,
            subjectAttribute,
            subjectRef,
            onSaveAction
        ]
    );

    const saveNow = useCallback(() => {
        window.clearTimeout(idleTimerRef.current);
        persist({ runSaveAction: true });
    }, [persist]);

    const scheduleIdleWork = useCallback(() => {
        window.clearTimeout(idleTimerRef.current);
        const delay = Math.max(0, autoSaveDelay ?? 800);
        idleTimerRef.current = window.setTimeout(async () => {
            if (saveMode === "auto") {
                await persist({ runSaveAction: true });
            }
            executeAction(onChangeAction);
        }, delay);
    }, [autoSaveDelay, saveMode, persist, onChangeAction]);

    useEffect(() => () => window.clearTimeout(idleTimerRef.current), []);

    // ---------------------------------------------------------------- loading

    const applySource = useCallback(nextSource => {
        loadKeyRef.current += 1;
        loadedSignatureRef.current = nextSource.signature;
        lastHtmlRef.current = nextSource.kind === "html" ? nextSource.content : null;
        baselineRef.current = "";
        setLoaded({
            key: loadKeyRef.current,
            content: nextSource.kind === "empty" ? undefined : nextSource.content
        });
        setDocDirty(false);
        setSubjectDraft(null);
        setExternalChange(false);
        setConfirmReload(false);
        setComposed(null);
    }, []);

    const isEcho = useCallback(nextSource => {
        if (nextSource.kind === "json") {
            return serializeDocument(nextSource.content) === baselineRef.current;
        }
        if (nextSource.kind === "html") {
            return nextSource.content === lastHtmlRef.current;
        }
        return false;
    }, []);

    useEffect(() => {
        if (!ready) {
            return;
        }
        if (source.signature === loadedSignatureRef.current) {
            return;
        }
        if (isEcho(source)) {
            loadedSignatureRef.current = source.signature;
            return;
        }
        if (loaded && dirtyRef.current) {
            // Someone else changed the template while this user was editing it.
            // Never silently discard their work: let them choose.
            setExternalChange(true);
            return;
        }
        applySource(source);
    }, [ready, source, loaded, isEcho, applySource, dirtyRef]);

    const reload = useCallback(() => {
        if (dirtyRef.current) {
            // Reloading throws away work, so ask first — in the widget itself
            // rather than through a browser dialog the user cannot place.
            setConfirmReload(true);
            return;
        }
        window.clearTimeout(idleTimerRef.current);
        applySource(source);
    }, [applySource, source, dirtyRef]);

    const confirmReloadNow = useCallback(() => {
        window.clearTimeout(idleTimerRef.current);
        setConfirmReload(false);
        applySource(source);
    }, [applySource, source]);

    const keepMyChanges = useCallback(() => {
        loadedSignatureRef.current = source.signature;
        setExternalChange(false);
    }, [source]);

    // ------------------------------------------------------------ editor wire

    const handleReady = useCallback(ref => {
        selectionRef.current = null;
        setEmailRef(ref);
        baselineRef.current = serializeDocument(ref.getJSON());
        setDocDirty(false);
    }, []);

    const handleUpdate = useCallback(
        ref => {
            setDocDirty(serializeDocument(ref.getJSON()) !== baselineRef.current);
            setComposed(null);
            scheduleIdleWork();
        },
        [scheduleIdleWork]
    );

    useEffect(() => {
        const editor = emailRef?.editor;
        if (!editor) {
            return undefined;
        }
        const sync = () => {
            setCanUndo(editor.can().undo());
            setCanRedo(editor.can().redo());
            // Remember where the cursor was while the user was typing, so a
            // toolbar insert lands there even if the editor lost its selection.
            if (editor.isFocused) {
                const { from, to } = editor.state.selection;
                selectionRef.current = { from, to };
            }
        };
        sync();
        editor.on("transaction", sync);
        return () => {
            editor.off("transaction", sync);
        };
    }, [emailRef]);

    useEffect(() => {
        const editor = emailRef?.editor;
        if (editor && editor.isEditable !== editable) {
            editor.setEditable(editable);
        }
    }, [emailRef, editable]);

    // ------------------------------------------------------- composed output

    // Rendering is in progress exactly when a non-design view has no output
    // yet. Deriving it rather than tracking a second flag means a cancelled
    // render can never leave the pane stuck on "Rendering...".
    const composing = view !== "design" && composed === null && Boolean(emailRef?.editor);

    useEffect(() => {
        if (view === "design" || composed || !emailRef?.editor) {
            return undefined;
        }
        let cancelled = false;
        emailRef
            .getEmail()
            .then(result => {
                if (!cancelled) {
                    setComposed(result);
                }
            })
            .catch(caught => {
                if (!cancelled) {
                    setError(`The email could not be rendered: ${errorMessage(caught)}`);
                    // Give the pane something to show so it stops waiting.
                    setComposed({ html: "", text: "" });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [view, composed, emailRef]);

    const previewHtml = useMemo(() => substituteVariables(composed?.html ?? "", variables), [composed, variables]);

    // -------------------------------------------------------------- shortcuts

    useEffect(() => {
        const node = rootRef.current;
        if (!node) {
            return undefined;
        }
        const onKeyDown = event => {
            if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
                event.preventDefault();
                event.stopPropagation();
                saveNow();
            }
        };
        node.addEventListener("keydown", onKeyDown, true);
        return () => node.removeEventListener("keydown", onKeyDown, true);
    }, [saveNow]);

    useEffect(() => {
        if (!warnOnUnsavedChanges || saveMode !== "manual" || !dirty) {
            return undefined;
        }
        const onBeforeUnload = event => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [warnOnUnsavedChanges, saveMode, dirty]);

    // ------------------------------------------------------------------- acts

    const insertVariable = useCallback(
        variable => {
            const editor = emailRef?.editor;
            if (!editor) {
                return;
            }
            const size = editor.state.doc.content.size;
            const remembered = selectionRef.current;
            const chain = editor.chain().focus();
            if (remembered && remembered.to <= size) {
                chain.insertContentAt(remembered, variable.token);
            } else {
                chain.insertContent(variable.token);
            }
            chain.run();
        },
        [emailRef]
    );

    const canSendTest = Boolean(onSendTestAction);
    const sendTest = useCallback(async () => {
        window.clearTimeout(idleTimerRef.current);
        // Write the current template first, so the action sends what is on
        // screen, but leave On save to an explicit save.
        if (editable) {
            const written = await persist({ runSaveAction: false });
            if (!written) {
                return;
            }
        }
        executeAction(onSendTestAction);
    }, [editable, persist, onSendTestAction]);

    const copyCurrentView = useCallback(() => {
        const value = view === "text" ? composed?.text : composed?.html;
        if (!value) {
            return;
        }
        if (!navigator.clipboard) {
            setError("This browser does not allow copying to the clipboard from here.");
            return;
        }
        navigator.clipboard
            .writeText(value)
            .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
            })
            .catch(caught => setError(`Copying failed: ${errorMessage(caught)}`));
    }, [view, composed]);

    const changeSubject = useCallback(
        event => {
            setSubjectDraft(event.target.value);
            scheduleIdleWork();
        },
        [scheduleIdleWork]
    );

    // ----------------------------------------------------------------- render

    const style = heightMode === "fill" ? props.style : { ...props.style, height: `${heightValue ?? 640}px` };
    const banner = error ?? themeError;

    return (
        <div
            className={classNames("mxre-root", props.class, { "mxre-root-fill": heightMode === "fill" })}
            ref={rootRef}
            style={style}
        >
            {showToolbar ? (
                <Toolbar
                    canRedo={canRedo}
                    canUndo={canUndo}
                    copied={copied}
                    dirty={dirty}
                    editable={editable}
                    inspectorOpen={inspectorOpen}
                    onCopy={copyCurrentView}
                    onInsertVariable={insertVariable}
                    onPreviewWidthChange={setPreviewWidth}
                    onRedo={() => emailRef?.editor?.chain().focus().redo().run()}
                    onReload={reload}
                    onSave={saveNow}
                    onSendTest={canSendTest ? sendTest : undefined}
                    onToggleInspector={() => setInspectorOpen(open => !open)}
                    onUndo={() => emailRef?.editor?.chain().focus().undo().run()}
                    onViewChange={setView}
                    previewWidth={previewWidth}
                    saveMode={saveMode}
                    saving={saving}
                    sendTestCaption={sendTestCaption?.value || "Send test"}
                    sendTestDisabled={saving || !onSendTestAction?.canExecute || onSendTestAction?.isExecuting}
                    showInspector={showInspector}
                    showViewSwitcher={showViewSwitcher}
                    variables={variables}
                    view={view}
                />
            ) : null}

            {banner ? (
                <div className="mxre-banner mxre-banner-error" role="alert">
                    <AlertIcon />
                    <span>{banner}</span>
                    {error ? (
                        <button className="mxre-link" onClick={() => setError(null)} type="button">
                            Dismiss
                        </button>
                    ) : null}
                </div>
            ) : null}

            {confirmReload ? (
                <div className="mxre-banner mxre-banner-warning" role="alert">
                    <AlertIcon />
                    <span>Reload the template? Your unsaved changes will be lost.</span>
                    <button className="mxre-link" onClick={confirmReloadNow} type="button">
                        Reload
                    </button>
                    <button className="mxre-link" onClick={() => setConfirmReload(false)} type="button">
                        Cancel
                    </button>
                </div>
            ) : null}

            {externalChange ? (
                <div className="mxre-banner mxre-banner-warning" role="alert">
                    <AlertIcon />
                    <span>This template was changed elsewhere. Your unsaved edits are still here.</span>
                    <button className="mxre-link" onClick={() => applySource(source)} type="button">
                        Load the other version
                    </button>
                    <button className="mxre-link" onClick={keepMyChanges} type="button">
                        Keep my changes
                    </button>
                </div>
            ) : null}

            {subjectAttribute ? (
                <label className="mxre-subject">
                    <span className="mxre-subject-label">Subject</span>
                    <input
                        className="mxre-subject-input"
                        disabled={!editable || !isWritable(subjectAttribute)}
                        onChange={changeSubject}
                        placeholder="Email subject"
                        type="text"
                        value={subject}
                    />
                </label>
            ) : null}

            <div className="mxre-body">
                <div className="mxre-view mxre-view-design" hidden={view !== "design"}>
                    {loaded ? (
                        <div className="mxre-canvas">
                            <EmailEditor
                                className="mxre-surface"
                                content={loaded.content}
                                editable={editable}
                                key={loaded.key}
                                onReady={handleReady}
                                onUpdate={handleUpdate}
                                onUploadImage={uploadImage}
                                placeholder={placeholderText?.value || undefined}
                                theme={theme}
                            >
                                <SelectionHighlight />
                                {showInspector && inspectorOpen ? (
                                    <Inspector.Root className="mxre-inspector">
                                        <NodeBreadcrumb />
                                        <Inspector.Document />
                                        <Inspector.Node />
                                        <Inspector.Text />
                                    </Inspector.Root>
                                ) : null}
                            </EmailEditor>
                        </div>
                    ) : (
                        <div className="mxre-placeholder">
                            {ready ? "Preparing the editor…" : "Loading the template…"}
                        </div>
                    )}
                </div>

                <div className="mxre-view" hidden={view !== "preview"}>
                    <PreviewPane html={previewHtml} loading={composing} width={previewWidth} />
                </div>

                <div className="mxre-view" hidden={view !== "html"}>
                    <CodePane emptyLabel="Nothing to show yet." loading={composing} value={composed?.html} />
                </div>

                <div className="mxre-view" hidden={view !== "text"}>
                    <CodePane emptyLabel="Nothing to show yet." loading={composing} value={composed?.text} />
                </div>
            </div>

            <div className="mxre-status">
                {!editable ? (
                    <span className="mxre-status-item">Read-only</span>
                ) : dirty ? (
                    <span className="mxre-status-item mxre-status-dirty">Unsaved changes</span>
                ) : (
                    <span className="mxre-status-item mxre-status-clean">
                        <CheckIcon size={14} />
                        {savedAt ? `Saved at ${formatTime(savedAt)}` : "No changes"}
                    </span>
                )}
                {saveMode === "auto" && editable ? (
                    <span className="mxre-status-item mxre-status-muted">Saves automatically</span>
                ) : null}
                {variables.length ? (
                    <span className="mxre-status-item mxre-status-muted">
                        {variables.length} variable{variables.length === 1 ? "" : "s"}
                    </span>
                ) : null}
            </div>
        </div>
    );
}
