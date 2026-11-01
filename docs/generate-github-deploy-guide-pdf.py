"""Generate PDF: zip → GitHub → Vercel → ongoing ops by machine."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

NAVY = colors.HexColor("#1B2C5B")
RED = colors.HexColor("#C8102E")
ROW_ALT = colors.HexColor("#F4F6FA")
LINE = colors.HexColor("#D5DBE7")
MUTED = colors.HexColor("#5B6578")
TEXT = colors.HexColor("#1A1F2C")
CODE_BG = colors.HexColor("#EEF1F6")

OUT = Path(__file__).with_name("SSG-github-vercel-deploy-guide.pdf")


def style_sheet():
    title = ParagraphStyle(
        "Title",
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=NAVY,
        spaceAfter=2 * mm,
    )
    subtitle = ParagraphStyle(
        "Subtitle",
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=MUTED,
        spaceAfter=3 * mm,
    )
    heading = ParagraphStyle(
        "Heading",
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=NAVY,
        spaceBefore=2.5 * mm,
        spaceAfter=1.5 * mm,
    )
    body = ParagraphStyle(
        "Body",
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=TEXT,
        alignment=TA_LEFT,
        spaceAfter=1.5 * mm,
    )
    cell = ParagraphStyle(
        "Cell",
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=TEXT,
    )
    note = ParagraphStyle(
        "Note",
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=MUTED,
        spaceBefore=1 * mm,
        spaceAfter=1 * mm,
    )
    machine = ParagraphStyle(
        "Machine",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=RED,
        spaceAfter=1 * mm,
    )
    return title, subtitle, heading, body, cell, note, machine


def step_table(rows, col_widths, cell):
    white = ParagraphStyle(
        "HeadCell",
        parent=cell,
        fontName="Helvetica-Bold",
        textColor=colors.white,
        fontSize=7.5,
        leading=10,
    )

    def p(text, s=cell):
        return Paragraph(text, s)

    data = [
        [
            Paragraph("Step", white),
            Paragraph("Where", white),
            Paragraph("What to do", white),
        ]
    ]
    for step, where, what in rows:
        data.append([p(f"<b>{step}</b>", cell), p(where, cell), p(what, cell)])

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT]),
            ]
        )
    )
    return t


def code_block(text: str):
    return Preformatted(
        text.strip() + "\n",
        ParagraphStyle(
            "Code",
            fontName="Courier",
            fontSize=6.5,
            leading=8.5,
            textColor=TEXT,
            backColor=CODE_BG,
            leftIndent=4,
            rightIndent=4,
            spaceBefore=1 * mm,
            spaceAfter=2 * mm,
        ),
    )


def main():
    title, subtitle, heading, body, cell, note, machine = style_sheet()
    page_w, _ = A4
    margin = 14 * mm
    usable = page_w - 2 * margin
    cw = [usable * 0.08, usable * 0.18, usable * 0.74]

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title="SSG Auto Parts — GitHub and Vercel deploy guide",
        author="SSG Auto Parts",
    )

    story = [
        Paragraph("SSG Auto Parts", title),
        Paragraph(
            "Move code to GitHub and host the web pilot on Vercel &nbsp;·&nbsp; "
            "Which machine does what",
            subtitle,
        ),
        Paragraph(
            "<b>PC A</b> = this development PC (GitHub push blocked). "
            "<b>Laptop B</b> = machine that can reach GitHub. "
            "<b>Browser</b> = Vercel or Supabase dashboard (works on either PC). "
            "Supabase stays one cloud project; Vercel only hosts the static Expo web app.",
            body,
        ),
        Paragraph("Overview", heading),
        Paragraph(
            "PC A creates a zip → you transfer it → Laptop B commits and pushes to GitHub → "
            "Vercel builds from GitHub → testers use the Vercel URL. "
            "After that, PC A can still run Supabase and Vercel tasks in the browser without pushing code.",
            body,
        ),
        Paragraph("Phase 1 — Prepare zip (PC A only)", heading),
        step_table(
            [
                (
                    "1.1",
                    "PC A",
                    "Confirm secrets are <b>not</b> in the folder you zip: "
                    "<b>.env.local</b>, <b>Pass.txt</b>, <b>supabase/.temp/</b>.",
                ),
                (
                    "1.2",
                    "PC A",
                    "Create the zip (includes <b>.git</b> history). Default output: "
                    "<b>F:\\Cursor\\SSG-POC\\ssg-autoparts-for-github.zip</b> (~29 MB).",
                ),
                (
                    "1.3",
                    "PC A → Laptop B",
                    "Send the zip by email attachment or USB. "
                    "Send <b>.env.local</b> values separately (password manager or USB only — "
                    "not inside the zip).",
                ),
            ],
            cw,
            cell,
        ),
        Paragraph("PowerShell on PC A (recreate zip anytime):", machine),
        code_block(
            r"""
Set-Location F:\Cursor\SSG-POC
tar -acf ssg-autoparts-for-github.zip `
  --exclude="ssg-autoparts/node_modules" `
  --exclude="ssg-autoparts/.expo" `
  --exclude="ssg-autoparts/dist" `
  --exclude="ssg-autoparts/web-build" `
  --exclude="ssg-autoparts/.env.local" `
  --exclude="ssg-autoparts/Pass.txt" `
  --exclude="ssg-autoparts/supabase/.temp" `
  ssg-autoparts
"""
        ),
        Paragraph("Included in zip vs excluded", heading),
        step_table(
            [
                (
                    "✓",
                    "In zip",
                    "app/, components/, lib/, types/, supabase/migrations, supabase/functions, "
                    "docs/, package.json, .env.local.example, .git/",
                ),
                (
                    "✗",
                    "Excluded",
                    "node_modules (run npm ci on B), .expo, dist, .env.local, Pass.txt, supabase/.temp",
                ),
            ],
            cw,
            cell,
        ),
        Paragraph("Phase 2 — Unpack and local setup (Laptop B)", heading),
        step_table(
            [
                (
                    "2.1",
                    "Laptop B",
                    "Unzip to a folder named <b>ssg-autoparts</b> with <b>package.json</b> at the root.",
                ),
                (
                    "2.2",
                    "Laptop B",
                    "Copy <b>.env.local.example</b> to <b>.env.local</b>. Fill "
                    "<b>EXPO_PUBLIC_SUPABASE_URL</b> and <b>EXPO_PUBLIC_SUPABASE_KEY</b> "
                    "(publishable key only). Set <b>EXPO_PUBLIC_AUTH_MODE=dev</b>.",
                ),
                (
                    "2.3",
                    "Laptop B",
                    "Install dependencies and optional web build smoke test.",
                ),
            ],
            cw,
            cell,
        ),
        Paragraph("Terminal on Laptop B:", machine),
        code_block(
            """
cd ssg-autoparts
npm ci
npx expo export -p web
"""
        ),
        Paragraph("Phase 3 — Git commit and push (Laptop B)", heading),
        step_table(
            [
                (
                    "3.1",
                    "Browser (B)",
                    "GitHub → New repository → <b>empty</b> (no README if you have local commits). "
                    "Copy the HTTPS URL.",
                ),
                (
                    "3.2",
                    "Laptop B",
                    "Stage source. Never add Pass.txt or .env.local.",
                ),
                (
                    "3.3",
                    "Laptop B",
                    "Commit, add remote <b>origin</b>, push.",
                ),
            ],
            cw,
            cell,
        ),
        Paragraph("Terminal on Laptop B:", machine),
        code_block(
            """
cd ssg-autoparts
git status

git add app components lib types supabase docs AGENTS.md
git add -u

git add components/CatalogueFilterBar.tsx components/CatalogueHierarchyPicker.tsx
git add components/PartListRow.tsx components/PreferenceMultiPick.tsx
git add lib/catalogue-preference-sort.ts lib/part-display.ts
git add lib/queries/catalogue-filters.ts lib/queries/catalogue-hierarchy.ts
git add supabase/migrations/010_client_itemlist_catalogue.sql
git add supabase/migrations/011_hierarchical_catalogue.sql
git add supabase/migrations/012_profile_catalogue_preferences.sql

git status
git commit -m "Hierarchical catalogue browse, onboarding preferences, and Excel import sync."

git remote add origin https://github.com/YOUR_ORG/ssg-autoparts.git
git push -u origin master
"""
        ),
        Paragraph(
            "If GitHub uses <b>main</b>: run <b>git branch -M main</b> before push, "
            "then <b>git push -u origin main</b>. "
            "If <b>origin</b> already exists: <b>git remote set-url origin …</b> then push.",
            note,
        ),
        Paragraph("Phase 4 — Vercel (Browser, once)", heading),
        step_table(
            [
                (
                    "4.1",
                    "Browser",
                    "vercel.com → Log in with GitHub → <b>Add New Project</b> → import <b>ssg-autoparts</b>.",
                ),
                (
                    "4.2",
                    "Browser",
                    "Build settings: Install <b>npm ci</b>. Build <b>npx expo export -p web</b>. "
                    "Output directory <b>dist</b>.",
                ),
                (
                    "4.3",
                    "Browser",
                    "Environment variables (Production): same names as .env.local — "
                    "EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY, EXPO_PUBLIC_AUTH_MODE, "
                    "optional EXPO_PUBLIC_SSG_WHATSAPP and EXPO_PUBLIC_SSG_PHONE.",
                ),
                (
                    "4.4",
                    "Browser",
                    "Deploy. Note the URL (e.g. https://your-project.vercel.app). "
                    "Every future <b>git push</b> to the connected branch redeploys automatically.",
                ),
                (
                    "4.5",
                    "Browser",
                    "Open the Vercel URL → sign in as a test buyer → browse → cart → submit quote once.",
                ),
            ],
            cw,
            cell,
        ),
        Paragraph("Phase 5 — Supabase (Browser on A or B; CLI optional)", heading),
        step_table(
            [
                (
                    "5.1",
                    "Browser",
                    "Ensure project is <b>active</b> (not paused). Catalogue imported. "
                    "Migrations 001–012 applied on the linked project.",
                ),
                (
                    "5.2",
                    "Browser",
                    "Authentication → Email on, confirm email off for pilot. "
                    "Hook <b>Before user created</b> → hook_restrict_signup.",
                ),
                (
                    "5.3",
                    "Browser",
                    "allowed_users + Auth users for each tester. Share passwords privately.",
                ),
                (
                    "5.4",
                    "PC A or B",
                    "Optional CLI: link project and deploy functions if code changed.",
                ),
            ],
            cw,
            cell,
        ),
        Paragraph("Optional terminal (PC A or Laptop B):", machine),
        code_block(
            """
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy import-parts
supabase functions deploy notify-quote
"""
        ),
        Paragraph(
            "Project ref: Supabase → Project Settings → General. "
            "Edge function secrets (Resend, etc.) live in the Supabase dashboard, not in Git.",
            note,
        ),
        Paragraph("Phase 6 — Day-to-day after go-live", heading),
        step_table(
            [
                (
                    "Code change",
                    "Laptop B (or A if push works later)",
                    "Edit → commit → <b>git push</b> → Vercel auto-rebuilds.",
                ),
                (
                    "New tester",
                    "Browser (A or B)",
                    "Supabase: row in allowed_users + Auth user. No Vercel change.",
                ),
                (
                    "Env var change",
                    "Browser",
                    "Vercel → Settings → Environment Variables → Redeploy.",
                ),
                (
                    "Catalogue import",
                    "Browser",
                    "Admin signs in on the <b>Vercel URL</b> → admin upload (Edge Function).",
                ),
                (
                    "PC A blocked on Git",
                    "PC A → B",
                    "Copy changed files or new zip → Laptop B commits and pushes.",
                ),
            ],
            cw,
            cell,
        ),
        Paragraph("What you do not need for web pilot", heading),
        Paragraph(
            "Apple Developer, Google Play, or EAS store builds — only for native app store later. "
            "Vercel Hobby is enough for a private pilot link; Supabase Free works for few testers "
            "(Pro avoids project pause during business testing).",
            body,
        ),
        Spacer(1, 2 * mm),
        Paragraph(
            "See also: docs/GITHUB-UPLOAD.md in the repo. "
            "SSG Auto Parts · Trusted since 1971",
            note,
        ),
    ]

    def on_page(canvas, doc_):
        canvas.saveState()
        canvas.setFillColor(RED)
        canvas.rect(0, A4[1] - 3.2 * mm, A4[0], 3.2 * mm, fill=1, stroke=0)
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 7)
        canvas.drawString(
            margin,
            8 * mm,
            "Internal — GitHub, Vercel, and Supabase pilot deployment",
        )
        canvas.drawRightString(A4[0] - margin, 8 * mm, f"Page {doc_.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
