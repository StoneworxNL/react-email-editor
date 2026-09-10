/**
 * @typedef Property
 * @type {object}
 * @property {string} key
 * @property {string} caption
 * @property {string} description
 * @property {string[]} objectHeaders
 * @property {ObjectProperties[]} objects
 * @property {Properties[]} properties
 */

/**
 * @typedef ObjectProperties
 * @type {object}
 * @property {PropertyGroup[]} properties
 * @property {string[]} captions
 */

/**
 * @typedef PropertyGroup
 * @type {object}
 * @property {string} caption
 * @property {PropertyGroup[]} propertyGroups
 * @property {Property[]} properties
 */

/**
 * @typedef Properties
 * @type {PropertyGroup}
 */

/**
 * @typedef Problem
 * @type {object}
 * @property {string} property
 * @property {("error" | "warning" | "deprecation")} severity
 * @property {string} message
 * @property {string} studioMessage
 * @property {string} url
 * @property {string} studioUrl
 */

const DOCS_URL = "https://github.com/stoneworx/email-editor-mendix";

/** Remove a property from the (nested) property group tree, in place. */
function hideProperty(groups, key) {
    if (!Array.isArray(groups)) {
        return;
    }
    for (const group of groups) {
        if (Array.isArray(group.properties)) {
            const index = group.properties.findIndex(property => property.key === key);
            if (index !== -1) {
                group.properties.splice(index, 1);
                return;
            }
        }
        hideProperty(group.propertyGroups, key);
    }
}

function hideProperties(groups, keys) {
    for (const key of keys) {
        hideProperty(groups, key);
    }
}

/**
 * @param {object} values
 * @param {Properties} defaultProperties
 * @param {("web"|"desktop")} target
 * @returns {Properties}
 */
export function getProperties(values, defaultProperties, _target) {
    const groups = defaultProperties.propertyGroups ?? defaultProperties;

    if (values.saveMode === "auto") {
        // The browser warning only makes sense while changes can be pending.
        hideProperty(groups, "warnOnUnsavedChanges");
    }

    if (values.heightMode === "fill") {
        hideProperty(groups, "heightValue");
    }

    if (values.themePreset !== "custom") {
        hideProperty(groups, "themeConfig");
    }

    if (!values.showToolbar) {
        hideProperty(groups, "showViewSwitcher");
    }

    if (!values.variablesDatasource) {
        hideProperties(groups, ["variableName", "variableLabel", "variableSample", "variablePrefix", "variableSuffix"]);
    }

    if (values.imageMode !== "microflow") {
        hideProperties(groups, [
            "imageDataAttribute",
            "imageNameAttribute",
            "imageUrlAttribute",
            "onImageUpload",
            "imageUploadTimeout"
        ]);
    }

    return defaultProperties;
}

/**
 * @param {Object} values
 * @returns {Problem[]} returns a list of problems.
 */
export function check(values) {
    /** @type {Problem[]} */
    const errors = [];

    if (!values.documentAttribute && !values.htmlAttribute) {
        errors.push({
            property: "documentAttribute",
            severity: "error",
            message:
                "Set a Document attribute, an Email HTML attribute, or both. Without one of them there is nowhere to load the template from or save it to.",
            url: DOCS_URL
        });
    } else if (!values.documentAttribute) {
        errors.push({
            property: "documentAttribute",
            severity: "warning",
            message:
                "Without a Document attribute the template is reloaded from the rendered email HTML, which is a lossy import: layout and styling can drift each time it is opened. Add an unlimited-length string attribute for the document to keep edits exact.",
            url: DOCS_URL
        });
    }

    if (values.themePreset === "custom" && !values.themeConfig) {
        errors.push({
            property: "themeConfig",
            severity: "warning",
            message: "The theme is set to Custom but no configuration was given, so the Basic theme is used.",
            url: DOCS_URL
        });
    }

    if (values.variablesDatasource && !values.variableName) {
        errors.push({
            property: "variableName",
            severity: "error",
            message: "Select the attribute that holds the variable name, otherwise no variable can be inserted.",
            url: DOCS_URL
        });
    }

    if (values.variablesDatasource && (!values.variablePrefix || !values.variableSuffix)) {
        errors.push({
            property: "variablePrefix",
            severity: "warning",
            message:
                "Without both a prefix and a suffix the inserted variables cannot be told apart from ordinary text when the email is merged.",
            url: DOCS_URL
        });
    }

    if (values.imageMode === "microflow") {
        if (!values.imageDataAttribute) {
            errors.push({
                property: "imageDataAttribute",
                severity: "error",
                message: "Select the attribute that receives the base64 image data before the upload action runs.",
                url: DOCS_URL
            });
        }
        if (!values.imageUrlAttribute) {
            errors.push({
                property: "imageUrlAttribute",
                severity: "error",
                message: "Select the attribute your upload action fills with the URL of the stored image.",
                url: DOCS_URL
            });
        }
        if (!values.onImageUpload) {
            errors.push({
                property: "onImageUpload",
                severity: "error",
                message: "Select the action that stores the uploaded image.",
                url: DOCS_URL
            });
        }
    }

    if (values.heightMode === "fixed" && values.heightValue && values.heightValue < 320) {
        errors.push({
            property: "heightValue",
            severity: "warning",
            message: "Below roughly 320 pixels the toolbar, editor and status bar no longer fit comfortably.",
            url: DOCS_URL
        });
    }

    if (values.autoSaveDelay !== undefined && values.autoSaveDelay < 0) {
        errors.push({
            property: "autoSaveDelay",
            severity: "error",
            message: "The change delay cannot be negative.",
            url: DOCS_URL
        });
    }

    return errors;
}

/**
 * @param {Object} values
 * @param {("web"|"desktop")} platform
 * @returns {string}
 */
export function getCustomCaption(values, _platform) {
    return values.saveMode === "auto" ? "Email template (auto-save)" : "Email template";
}
