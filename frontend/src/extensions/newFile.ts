import { Mark, markInputRule, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const WIKILINK = /\[\[([^\]]+)\]\]/g;

export const NewFile = Mark.create({
  name: 'newFile',
  inclusive: false,

  addAttributes() {
    return {
      filename: {
        default: "no name was provided",
        parseHTML: element => element.getAttribute('data-filename'),
        renderHTML: attributes => {
          return { 
            'data-filename': attributes.filename,
            'href': '#', 
          }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-type="new-file"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(HTMLAttributes, { 'data-type': 'new-file' }), 0];
  },

  
  renderMarkdown: (mark, helpers) => {
    const content = helpers.renderChildren(mark)
    return `[[${content}]]`
  },

  addInputRules() {
    return [
      markInputRule({
        find: /\[\[([^\]]+)\]\]\s$/,
        type: this.type,
        getAttributes: match => {
          return { filename: match[1] };
        }
      }),
    ]
  },

  
  addProseMirrorPlugins() {
    const markType = this.type

    return [
      new Plugin({
        key: new PluginKey('newFileWikilink'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some(tr => tr.docChanged)) return null

          const insertedClosingBracket = transactions.some(tr =>
            tr.steps.some(step => {
              const slice = (step as { slice?: { content: { size: number; textBetween: (from: number, to: number) => string } } }).slice
              if (!slice) return true
              return slice.content.textBetween(0, slice.content.size).includes(']')
            }),
          )
          if (!insertedClosingBracket) return null

          const matches: { from: number; to: number; filename: string }[] = []

          newState.doc.descendants((node, pos, parent) => {
            if (!node.isText || !node.text) return
            if (parent?.type.spec.code) return
            if (node.marks.some(m => m.type === markType || m.type.spec.code)) return

            WIKILINK.lastIndex = 0
            let m: RegExpExecArray | null
            while ((m = WIKILINK.exec(node.text)) !== null) {
              matches.push({
                from: pos + m.index,
                to: pos + m.index + m[0].length,
                filename: m[1],
              })
            }
          })

          if (matches.length === 0) return null

          const tr = newState.tr
          for (const { from, to, filename } of matches) {
            const mappedFrom = tr.mapping.map(from)
            const mappedTo = tr.mapping.map(to)
            tr.replaceWith(
              mappedFrom,
              mappedTo,
              newState.schema.text(filename, [markType.create({ filename })]),
            )
          }

          return tr.steps.length ? tr : null
        },
      }),
    ]
  },
})