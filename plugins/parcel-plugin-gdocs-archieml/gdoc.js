const archieml = require("archieml");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const fileType = require("file-type");
const MarkdownIt = require("markdown-it");

const md = new MarkdownIt({
  html: true,
  linkify: false,
  typographer: false,
});

async function toBase64(src) {
  const buffer = await fetch(src).then((res) => res.buffer());

  const mime = await fileType.fromBuffer(buffer);
  const b64 = await buffer.toString("base64");

  return `data:${mime["mime"]};base64,${b64}`;
}

async function toText(node, $) {
  const item = $(node);

  if (node.nodeType === 3) {
    return item.text();
  }

  if (node.tagName == "div") {
    return item.text();
  }

  if (node.tagName == "a") {
    const href = item.attr("href");

    if (href.indexOf("datawrapper") !== -1) {
      let match = href.match(/https:\/\/datawrapper.dwcdn.net\/(.+)\/1\//);
      if (!match) {
        match = href.match(/datawrapper.de\/_\/(.*)\//);
      }
      if (match && match.length > 1) {
        const dw_code = match[1];
        const embed = `
        <div>
        <iframe title="A DataWrapper chart" aria-label="chart" id="datawrapper-chart-${dw_code}" src="https://datawrapper.dwcdn.net/${dw_code}/1/" scrolling="no" frameborder="0" style="width: 0; min-width: 100% !important; border: none;" height="431">
        </iframe>
        <script type="text/javascript">!function(){"use strict";window.addEventListener("message",(function(a){if(void 0!==a.data["datawrapper-height"])for(var e in a.data["datawrapper-height"]){var t=document.getElementById("datawrapper-chart-"+e)||document.querySelector("iframe[src*='"+e+"']");t&&(t.style.height=a.data["datawrapper-height"][e]+"px")}}))}();</script>
        </div>`.replace(/^\s*/gm, " ");
        return embed;
      }
    }

    return `<a href='${item.attr("href")}'>${item.text()}</a>`;
  }
  
  const nonTextNodes = item.contents().filter((d) => d.nodeType !== 3);
  if(node.tagName === 'a') {
    console.log('node found still', item.attr('href'))
  }

  if (nonTextNodes.length > 0) {
    if(node.tagName === 'a') {
        console.log(node)
      }
    let content = await Promise.all(
      nonTextNodes
        .map(async (i, e) => {
          return await toText(e, $);
        })
        .toArray()
    );

    content = content.join("\n");

    if (node.tagName === "h3") {
      return `<p class='label super-font'>${content}</p>`;
    } else {
      return content;
    }
  } else {
    if (node.tagName === "img") {
      const b64Img = await toBase64(item.attr("src"));
      let imgContent = "";
      if (item.attr("title"))
        imgContent += `<p class='label super-font'>${item.attr("title")}</p>`;

      if (item.attr("alt"))
        imgContent += `<p class='label-text super-font'>${item.attr(
          "alt"
        )}</p>`;

      imgContent += `<p class='img'><img src='${b64Img}'></p>`;
      return "\n" + imgContent + "\n";
    }

    if (node.tagName == "h3")
      return `<p class='label super-font'>${item.text()}</p>`;

    return item.text();
  }
}

class GDoc {
  constructor(url, logger) {
    this.url = url;
    const match = this.url.match(/\/d\/([^/]*)/);
    this.code = match[1];
    this.logger = logger;
  }

  async process() {
    this.logger.info("Processing");
    await this.processArchieml();
    await this.processHtml();
  }

  async processArchieml() {
    const textUrl = `https://docs.google.com/document/d/${this.code}/export?format=txt`;
    this.logger.debug({ msg: "Processing ArchieML content", textUrl });

    const content = await (await fetch(textUrl)).text();
    this.attributes = archieml.load(content.replace(/:\/\//g, "COLON//"));
    const keys = Object.keys(this.attributes);
    this.logger.debug({ msg: "Processing ArchieML keys", keys });
    keys.forEach((key) => {
      this.attributes[key] = this.attributes[key].replace(/COLON\/\//g, "://");
    });
  }

  async processHtml() {
    const htmlUrl = `https://docs.google.com/document/d/${this.code}/export?format=html`;
    this.logger.debug({ msg: "Processing HTML content", htmlUrl });

    const content = await (await fetch(htmlUrl)).text();
    const $ = cheerio.load(content);

    const contentStart = $("span:contains('content:')").parent();

    let currentContent = contentStart.next();
    let lines = [];
    while (
      currentContent.length > 0 &&
      currentContent.text().indexOf(":end") === -1
    ) {
      let contents;
      let tagName = currentContent[0].name;

      if (tagName === "table") {
        contents = "<div class='fake-table'>";
        let rows = currentContent.find("tr").toArray();
        for (const row of rows) {
          contents += "<div>";
          const cells = $(row).find("td").toArray();
          for (const cell of cells) {
            const results = await toText(cell, $);
            contents += `<div>\n${results}\n</div>\n`;
          }
          contents += "</div>";
        }
      } else {
        const contentElements = await currentContent.contents().toArray();
        contents = "";
        for (const element of contentElements) {
          const results = await toText(element, $);
          contents += results;
        }

        if (tagName == "ul") {
          contents = `* ${contents}`;
        } else if (tagName === "ol") {
          contents = `1. ${contents}`;
        } else if (tagName === "h1") {
          contents = `## ${contents}`;
        } else if (tagName === "h2") {
          contents = `### ${contents}`;
        } else if (tagName === "h3") {
          contents = `<p class='label super-font'>${contents}</p>`;
        } else if (tagName === "h4") {
          contents = `<p class='label-text super-font'>${contents}</p>`;
        }
      }
      lines.push(contents);
      currentContent = currentContent.next();
    }

    const rawContent = lines.join("\n").replace(/\n+/g, "\n\n");

    this.attributes.raw_content = rawContent;
    this.attributes.processed_content = md.render(rawContent);
  }
}

module.exports = GDoc;
