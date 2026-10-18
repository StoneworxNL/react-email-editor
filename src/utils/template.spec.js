import {
    buildToken,
    parseDocument,
    readVariables,
    resolveSource,
    serializeDocument,
    substituteVariables
} from "./template";
import { datasource, listAttribute } from "../__tests__/mendixMocks";

const DOC = { type: "doc", content: [{ type: "paragraph" }] };

describe("parseDocument", () => {
    it("returns the document for valid editor JSON", () => {
        expect(parseDocument(JSON.stringify(DOC))).toEqual(DOC);
    });

    it.each([
        ["an empty string", ""],
        ["whitespace", "   "],
        ["invalid JSON", "{not json"],
        ["an array", "[]"],
        ["another object", '{"type":"text"}'],
        ["a doc without content", '{"type":"doc"}'],
        ["a non-string", null]
    ])("returns null for %s", (_label, raw) => {
        expect(parseDocument(raw)).toBeNull();
    });
});

describe("serializeDocument", () => {
    it("is empty for no document", () => {
        expect(serializeDocument(null)).toBe("");
    });

    it("does not throw on a circular structure", () => {
        const circular = {};
        circular.self = circular;
        expect(serializeDocument(circular)).toBe("");
    });
});

describe("resolveSource", () => {
    it("prefers the JSON document", () => {
        const source = resolveSource(JSON.stringify(DOC), "<p>html</p>");
        expect(source.kind).toBe("json");
        expect(source.content).toEqual(DOC);
    });

    it("falls back to HTML when the document is unusable", () => {
        expect(resolveSource("broken", "<p>html</p>")).toEqual({
            kind: "html",
            content: "<p>html</p>",
            signature: "html:<p>html</p>"
        });
    });

    it("is empty when neither holds anything", () => {
        expect(resolveSource("", "  ").kind).toBe("empty");
    });

    it("gives equal documents equal signatures", () => {
        expect(resolveSource(JSON.stringify(DOC), "").signature).toBe(
            resolveSource(JSON.stringify(DOC, null, 2), "").signature
        );
    });
});

describe("buildToken", () => {
    it("wraps the name", () => {
        expect(buildToken("{%", "FirstName", "%}")).toBe("{%FirstName%}");
    });

    it("tolerates missing delimiters", () => {
        expect(buildToken(undefined, "x", undefined)).toBe("x");
    });
});

describe("readVariables", () => {
    const ds = datasource(["a", "b", "c"]);

    it("is empty while the data source is not available", () => {
        expect(readVariables(datasource(["a"], "loading"), {}, "{%", "%}")).toEqual([]);
        expect(readVariables(undefined, {}, "{%", "%}")).toEqual([]);
    });

    it("builds tokens from names with the prefix and suffix", () => {
        const variables = readVariables(ds, { name: listAttribute({ a: "FirstName" }) }, "{{", "}}");
        expect(variables).toEqual([
            expect.objectContaining({ id: "a", name: "FirstName", token: "{{FirstName}}", label: "FirstName" })
        ]);
    });

    it("inserts a full token exactly as stored and ignores the delimiters", () => {
        const variables = readVariables(
            ds,
            {
                name: listAttribute({ a: "ignored" }),
                token: listAttribute({ a: "{%LastName%}" }),
                label: listAttribute({ a: "Last name" })
            },
            "{{",
            "}}"
        );
        expect(variables[0]).toEqual(
            expect.objectContaining({ token: "{%LastName%}", name: undefined, label: "Last name" })
        );
    });

    it("uses the token as the label when there is neither label nor name", () => {
        const variables = readVariables(ds, { token: listAttribute({ b: "{%Email%}" }) }, "{%", "%}");
        expect(variables).toEqual([expect.objectContaining({ id: "b", label: "{%Email%}" })]);
    });

    it("drops entries with neither a name nor a token", () => {
        const variables = readVariables(ds, { name: listAttribute({ a: "A", c: "" }) }, "{%", "%}");
        expect(variables.map(v => v.id)).toEqual(["a"]);
    });

    it("reads the sample value", () => {
        const variables = readVariables(
            ds,
            { name: listAttribute({ a: "A" }), sample: listAttribute({ a: "Ada" }) },
            "{%",
            "%}"
        );
        expect(variables[0].sample).toBe("Ada");
    });
});

describe("substituteVariables", () => {
    const byName = { name: "FirstName", prefix: "{%", suffix: "%}", token: "{%FirstName%}", sample: "Ada" };
    const byToken = { name: undefined, prefix: "{%", suffix: "%}", token: "{%Order.Total%}", sample: "$5" };

    it("replaces every occurrence of a named token, also with inner spaces", () => {
        expect(substituteVariables("Hi {%FirstName%} / {% FirstName %}", [byName])).toBe("Hi Ada / Ada");
    });

    it("replaces a full token literally, including regex characters", () => {
        expect(substituteVariables("Total {%Order.Total%}; {%OrderXTotal%}", [byToken])).toBe(
            "Total $5; {%OrderXTotal%}"
        );
    });

    it("keeps dollar signs in sample values literal", () => {
        expect(substituteVariables("{%Order.Total%}", [{ ...byToken, sample: "$& $1" }])).toBe("$& $1");
    });

    it("leaves tokens without a sample alone", () => {
        expect(substituteVariables("{%FirstName%}", [{ ...byName, sample: undefined }])).toBe("{%FirstName%}");
    });

    it("passes non-strings and empty input through", () => {
        expect(substituteVariables("", [byName])).toBe("");
        expect(substituteVariables(undefined, [byName])).toBeUndefined();
        expect(substituteVariables("x", [])).toBe("x");
    });
});
