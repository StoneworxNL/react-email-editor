/**
 * A small, visually consistent icon set for the widget chrome.
 * The editor surface itself uses the icons that ship with @react-email/editor.
 */

function Icon({ children, size = 16, ...rest }) {
    return (
        <svg
            aria-hidden="true"
            fill="none"
            focusable="false"
            height={size}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            width={size}
            xmlns="http://www.w3.org/2000/svg"
            {...rest}
        >
            {children}
        </svg>
    );
}

export const SaveIcon = props => (
    <Icon {...props}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
        <path d="M17 21v-8H7v8M7 3v5h8" />
    </Icon>
);

export const UndoIcon = props => (
    <Icon {...props}>
        <path d="M3 7v6h6" />
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 3L3 13" />
    </Icon>
);

export const RedoIcon = props => (
    <Icon {...props}>
        <path d="M21 7v6h-6" />
        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3L21 13" />
    </Icon>
);

export const RefreshIcon = props => (
    <Icon {...props}>
        <path d="M21 12a9 9 0 1 1-2.6-6.4" />
        <path d="M21 3v6h-6" />
    </Icon>
);

export const CopyIcon = props => (
    <Icon {...props}>
        <rect height="13" rx="2" width="13" x="9" y="9" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
);

export const DesktopIcon = props => (
    <Icon {...props}>
        <rect height="12" rx="2" width="18" x="3" y="4" />
        <path d="M8 20h8M12 16v4" />
    </Icon>
);

export const MobileIcon = props => (
    <Icon {...props}>
        <rect height="18" rx="2" width="12" x="6" y="3" />
        <path d="M11 18h2" />
    </Icon>
);

export const PanelIcon = props => (
    <Icon {...props}>
        <rect height="16" rx="2" width="18" x="3" y="4" />
        <path d="M15 4v16" />
    </Icon>
);

export const VariableIcon = props => (
    <Icon {...props}>
        <path d="M8 3c-2 3-2 15 0 18M16 3c2 3 2 15 0 18" />
        <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
    </Icon>
);

export const AlertIcon = props => (
    <Icon {...props}>
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </Icon>
);

export const CheckIcon = props => (
    <Icon {...props}>
        <path d="m20 6-11 11-5-5" />
    </Icon>
);

export const ChevronDownIcon = props => (
    <Icon {...props}>
        <path d="m6 9 6 6 6-6" />
    </Icon>
);

export const SendIcon = props => (
    <Icon {...props}>
        <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
        <path d="m21.854 2.147-10.94 10.939" />
    </Icon>
);

export const SunIcon = props => (
    <Icon {...props}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </Icon>
);

export const MoonIcon = props => (
    <Icon {...props}>
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Icon>
);
