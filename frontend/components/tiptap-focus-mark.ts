import { Mark } from "@tiptap/core";

export const FocusPassage = Mark.create({
  name: "focusPassage",

  parseHTML() {
    return [{ tag: "span[data-focus-passage]" }];
  },

  renderHTML() {
    return [
      "span",
      {
        "data-focus-passage": "",
        class:
          "bg-amber-100 border-b-2 border-amber-300 rounded px-0.5",
      },
      0,
    ];
  },
});
