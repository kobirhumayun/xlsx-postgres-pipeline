import React, { useRef } from "react";
import Editor from "@monaco-editor/react";

export function SqlEditor({ value, onChange, onRun }) {
    const editorRef = useRef(null);
    const onRunRef = useRef(onRun);
    onRunRef.current = onRun;

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;

        // Register the Ctrl+Enter shortcut
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            if (onRunRef.current) onRunRef.current();
        });
    };

    return (
        <Editor
            height="100%"
            defaultLanguage="pgsql"
            value={value}
            onChange={(newValue) => onChange(newValue || "")}
            onMount={handleEditorDidMount}
            options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: false,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                fontFamily: "var(--font-geist-mono), monospace",
            }}
        />
    );
}
