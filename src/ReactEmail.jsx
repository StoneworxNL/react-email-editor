import "@react-email/editor/themes/default.css";
import "./ui/ReactEmail.css";
import { EmailTemplateEditor } from "./components/EmailTemplateEditor";

export function ReactEmail(props) {
    return <EmailTemplateEditor {...props} />;
}
