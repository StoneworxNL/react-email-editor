/**
 * Small helpers around the Mendix pluggable widget value objects.
 *
 * Every one of them tolerates `undefined`, because almost all properties of
 * this widget are optional and a modeller may leave them empty.
 */

const AVAILABLE = "available";
const LOADING = "loading";

/** True when the value object exists and its data has been resolved. */
export function isAvailable(value) {
    return Boolean(value) && value.status === AVAILABLE;
}

/** True while Mendix is still fetching the value. */
export function isLoading(value) {
    return Boolean(value) && value.status === LOADING;
}

/** True when the value can be written to. */
export function isWritable(value) {
    return isAvailable(value) && !value.readOnly;
}

/** Current string content of an attribute, empty string when there is none. */
export function readString(value) {
    if (!isAvailable(value) || value.value === undefined || value.value === null) {
        return "";
    }
    return String(value.value);
}

/**
 * Write a string to an attribute, but only when that is both allowed and
 * necessary. Returns true when a write actually happened.
 */
export function writeString(value, next) {
    if (!isWritable(value)) {
        return false;
    }
    if (readString(value) === next) {
        return false;
    }
    value.setValue(next);
    return true;
}

/** Run a Mendix action if it is configured and not already running. */
export function executeAction(action) {
    if (action && action.canExecute && !action.isExecuting) {
        action.execute();
        return true;
    }
    return false;
}

/** True when none of the configured values is still loading. */
export function allSettled(values) {
    return values.every(value => !isLoading(value));
}

/**
 * Read a Mendix list data source into plain objects.
 *
 * `mappers` is an object of `{ key: attributeValueGetter }`; each getter is the
 * `ListAttributeValue` for that column. Objects whose value is unavailable are
 * skipped rather than rendered as blanks.
 */
export function readListAttribute(listAttribute, item) {
    if (!listAttribute) {
        return undefined;
    }
    const value = listAttribute.get(item);
    if (!isAvailable(value) || value.value === undefined || value.value === null) {
        return undefined;
    }
    return String(value.value);
}
