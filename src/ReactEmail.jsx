import "@react-email/editor/themes/default.css";
import "./ui/ReactEmail.css";
import { EmailTemplateEditor } from "./components/EmailTemplateEditor";
import { createElement } from "react";

export function ReactEmail(props) {
    return <EmailTemplateEditor {...props} />;
}
