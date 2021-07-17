const Handlebars = require('handlebars')
const handlebarsWax = require('handlebars-wax')
const handlebarsHelpersPackage = require('handlebars-helpers')
// const debug = require('debug')('parcel:ai2html');

module.exports = {
  ai2html: function(path) {    
      const handlebars = Handlebars.create()
      handlebarsHelpersPackage({ handlebars })

      const config = {
        partials: `content/${this.relativePath}/**/*.html`,
      }

      const wax = handlebarsWax(handlebars).partials(config.partials)

      const style_block = `
      <style>
            /* These are the styles for ai2html */
            
            #g-${path}-laptop, #g-${path}-medium, #g-${path}-mobile {
                display: none;
            }

            @media (max-width: 490px) {
                #g-${path}-mobile {
                    display: block;
                }
            }

            @media (min-width: 490px) and (max-width: 620px) {
                #g-${path}-laptop {
                    display: block;
                }
            }

            @media (min-width: 620px)  {
                #g-${path}-medium {
                    display: block;
                }
            }

        </style>`
        try {
            let results = wax.handlebars['partials'][path]()
            return new Handlebars.SafeString(style_block + results)
        } catch(e) {
            let errorMsg = `
            <div style="background: pink; color: darkred; padding: 30px; margin: 5px;">
            🚨 Can't find ai2html export ${path}.html in /content/${this.relativePath}
            </div>`
            return new Handlebars.SafeString(errorMsg)
        }
  }
}
