// Small stand-ins for the Mendix pluggable widget value objects, for tests.

export function attribute(value, { readOnly = false, status = "available" } = {}) {
    const attr = {
        status,
        readOnly,
        value,
        setValue: jest.fn(next => {
            attr.value = next;
        })
    };
    return attr;
}

export function action({ canExecute = true, isExecuting = false } = {}) {
    return { canExecute, isExecuting, execute: jest.fn() };
}

export function listAttribute(valuesById) {
    return {
        get: jest.fn(item => {
            const value = valuesById[item.id];
            return value === undefined ? { status: "unavailable", value: undefined } : { status: "available", value };
        })
    };
}

export function datasource(ids, status = "available") {
    return { status, items: ids.map(id => ({ id })) };
}
