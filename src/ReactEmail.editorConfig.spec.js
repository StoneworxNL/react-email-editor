import { check, getCustomCaption, getProperties } from "./ReactEmail.editorConfig";

const base = {
    documentAttribute: "Doc",
    htmlAttribute: "Html",
    saveMode: "manual",
    heightMode: "fixed",
    heightValue: 640,
    themePreset: "basic",
    imageMode: "dataUrl",
    autoSaveDelay: 800
};

function problemsFor(values) {
    return check({ ...base, ...values }).map(problem => `${problem.severity}:${problem.property}`);
}

describe("check", () => {
    it("is quiet for a sensible configuration", () => {
        expect(problemsFor({})).toEqual([]);
    });

    it("needs somewhere to store the template", () => {
        expect(problemsFor({ documentAttribute: undefined, htmlAttribute: undefined })).toEqual([
            "error:documentAttribute"
        ]);
    });

    it("warns that HTML alone is a lossy store", () => {
        expect(problemsFor({ documentAttribute: undefined })).toEqual(["warning:documentAttribute"]);
    });

    it("accepts a full token instead of a name", () => {
        const values = { variablesDatasource: {}, variablePrefix: "{%", variableSuffix: "%}" };
        expect(problemsFor(values)).toEqual(["error:variableName"]);
        expect(problemsFor({ ...values, variableToken: "Token" })).toEqual([]);
        expect(problemsFor({ ...values, variableName: "Name" })).toEqual([]);
    });

    it("lists what microflow uploads still need", () => {
        expect(problemsFor({ imageMode: "microflow" })).toEqual([
            "error:imageDataAttribute",
            "error:imageUrlAttribute",
            "error:onImageUpload"
        ]);
    });

    it("flags a cramped height and a negative delay", () => {
        expect(problemsFor({ heightValue: 200, autoSaveDelay: -1 })).toEqual([
            "warning:heightValue",
            "error:autoSaveDelay"
        ]);
    });

    it("links every problem to the widget's documentation", () => {
        const [problem] = check({ ...base, documentAttribute: undefined });
        expect(problem.url).toBe("https://github.com/StoneworxNL/react-email-editor");
    });
});

describe("getProperties", () => {
    const keysAfter = values => {
        const groups = [
            {
                caption: "All",
                properties: [
                    "warnOnUnsavedChanges",
                    "heightValue",
                    "themeConfig",
                    "showViewSwitcher",
                    "variableName",
                    "variableToken",
                    "variablePrefix",
                    "sendTestCaption",
                    "imageDataAttribute",
                    "imageUploadTimeout"
                ].map(key => ({ key }))
            }
        ];
        getProperties({ ...base, showToolbar: true, ...values }, groups, "web");
        return groups[0].properties.map(property => property.key);
    };

    it("hides what does not apply", () => {
        expect(keysAfter({})).toEqual(["warnOnUnsavedChanges", "heightValue", "showViewSwitcher"]);
    });

    it("shows variable, send test and upload settings once they are in use", () => {
        expect(
            keysAfter({ variablesDatasource: {}, onSendTestAction: {}, imageMode: "microflow", themePreset: "custom" })
        ).toEqual([
            "warnOnUnsavedChanges",
            "heightValue",
            "themeConfig",
            "showViewSwitcher",
            "variableName",
            "variableToken",
            "variablePrefix",
            "sendTestCaption",
            "imageDataAttribute",
            "imageUploadTimeout"
        ]);
    });
});

describe("getCustomCaption", () => {
    it("says when the template saves itself", () => {
        expect(getCustomCaption({ saveMode: "auto" })).toBe("Email template (auto-save)");
        expect(getCustomCaption({ saveMode: "manual" })).toBe("Email template");
    });
});
