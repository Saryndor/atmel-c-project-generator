import * as fs from "fs";
import * as path from "path";

export async function copyTemplateDir(
    templateDir: string,
    targetDir: string,
    vars: Record<string, string>
) {
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const entries = fs.readdirSync(templateDir, { withFileTypes: true });

    for (const entry of entries) {
        const src = path.join(templateDir, entry.name);
        const dstName = entry.name;             // no .tpl renaming (simplified)
        const dst = path.join(targetDir, dstName);

        if (entry.isDirectory()) {
            await copyTemplateDir(src, dst, vars);
        } else {
            let content = fs.readFileSync(src, "utf8");

            // Replace all {{VARS}}
            for (const [key, value] of Object.entries(vars)) {
                const pattern = new RegExp(`{{${key}}}`, "g");
                content = content.replace(pattern, value);
            }

            fs.writeFileSync(dst, content, "utf8");
        }
    }
}
