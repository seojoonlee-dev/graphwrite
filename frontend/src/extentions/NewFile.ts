import { Mark, InputRule } from '@tiptap/core'

export interface NewFileOptions {
  createUrl: (filename: string) => string
}

export const NewFile = Mark.create<NewFileOptions>({
  name: 'newFile',

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: element => element.getAttribute('href'),
        renderHTML: attributes => ({ href: attributes.href }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', HTMLAttributes, 0]
  },

  markdownTokenizer: {
    name: 'newFile',
    level: 'inline',
    start: (src) => src.indexOf('[['),
    tokenize(src, _tokens, lexer) {
      const match = /^\[\[([^\]]+)\]\]/.exec(src)
      if (!match) return undefined
      
      const fileName = match[1].trim()
      return {
        type: 'newFile',
        raw: match[0],
        text: fileName,
        tokens: lexer.inlineTokens ? lexer.inlineTokens(fileName) : [],
      }
    },
  },

  parseMarkdown(this: any, token, helpers) {
    const fileName = token.text || token.content || 'unknown'
    
    const href = this.options?.createUrl 
      ? this.options.createUrl(fileName)
      : `/${fileName}`

    const content = helpers.parseInline(token.tokens || [])
    return helpers.applyMark('wikiLink', content, { href })
  },

  renderMarkdown: {
    open: '[[',
    close: ']]',
    mixable: true,
    expelEnclosingWhitespace: true,
  } as any,

  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^\]]+)\]\]$/,
        handler: ({ state, range, match }) => {
          const fileName = match[1]?.trim()

          if (fileName) {
            const href = this.options.createUrl(fileName)

            state.tr.replaceWith(
              range.from,
              range.to,
              state.schema.text(fileName, [this.type.create({ href })])
            )
            state.tr.removeStoredMark(this.type)
          }
        },
      }),
    ]
  },
})