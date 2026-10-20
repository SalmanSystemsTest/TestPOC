"""Generate a short PDF of store-only production costs."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
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

OUT = Path(__file__).with_name("SSG-production-costs.pdf")


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
        spaceBefore=2 * mm,
        spaceAfter=1.5 * mm,
    )
    body = ParagraphStyle(
        "Body",
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=TEXT,
        alignment=TA_LEFT,
        spaceAfter=1.2 * mm,
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
        spaceBefore=1.5 * mm,
        spaceAfter=1 * mm,
    )
    return title, subtitle, heading, body, cell, note


def table(data, col_widths):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 7.5),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, -1), 7.5),
                ("TEXTCOLOR", (0, 1), (-1, -1), TEXT),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 2.4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.4),
                ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT]),
            ]
        )
    )
    return t


def header_row(labels, cell):
    white = ParagraphStyle(
        "HeadCell",
        parent=cell,
        fontName="Helvetica-Bold",
        textColor=colors.white,
        fontSize=7.5,
        leading=10,
    )
    return [Paragraph(label, white) for label in labels]


def main():
    title, subtitle, heading, body, cell, note = style_sheet()
    page_w, _ = A4
    margin = 14 * mm
    usable = page_w - 2 * margin

    def p(text, s=cell):
        return Paragraph(text, s)

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title="SSG Auto Parts — Store production costs",
        author="SSG Auto Parts",
    )

    story = [
        Paragraph("SSG Auto Parts", title),
        Paragraph(
            "Play Store and App Store after go-live &nbsp;·&nbsp; "
            "USD list prices, September 2026 &nbsp;·&nbsp; "
            "Planned at 1,000 active users / month",
            subtitle,
        ),
        Paragraph(
            "Buyers install from the stores. There is no public web app. "
            "Supabase holds the catalogue and login. Resend emails the quote PDF. "
            "The SSG Orders sheet is the working log. SMS is the only bill that "
            "grows with buyers. New store builds use Expo EAS (Free).",
            body,
        ),
        Paragraph("1. One-time and yearly", heading),
    ]

    one_time = [
        header_row(["Item", "Amount", "Notes"], cell),
        [
            p("<b>Google Play</b> developer account", cell),
            p("$25 once", cell),
            p("Required to list the Android app.", cell),
        ],
        [
            p("<b>Apple Developer</b> programme", cell),
            p("$99 / year", cell),
            p("Required to list on the App Store. Renews every year.", cell),
        ],
        [
            p("<b>Resend DNS</b> on SSG’s existing website domain", cell),
            p("$0", cell),
            p("So quote mail can reach SSG sales. Set RESEND_TO_EMAIL to the live inbox and RESEND_FROM to an address on that domain.", cell),
        ],
    ]

    monthly = [
        header_row(["Service", "At 1,000 users", "Monthly", "When the rate changes"], cell),
        [
            p("<b>Supabase</b>", cell),
            p("Pro — project stays up, first compute included", cell),
            p("$25", cell),
            p("Pro includes 100,000 MAU. After that <b>$0.00325 per extra MAU</b>.", cell),
        ],
        [
            p("<b>Resend</b>", cell),
            p("Free — one quote email per order stays under the cap", cell),
            p("$0", cell),
            p("Free: <b>3,000 emails/month and 100/day</b>. Then Pro <b>$20</b> for 50,000. Extra: <b>$0.90 per 1,000 emails</b>.", cell),
        ],
        [
            p("<b>Google Sheets</b>", cell),
            p("SSG Orders tab", cell),
            p("$0", cell),
            p("No volume charge at this scale.", cell),
        ],
        [
            p("<b>Expo EAS</b> Build", cell),
            p("Free — 15 Android + 15 iOS builds / month", cell),
            p("$0", cell),
            p("Enough to ship store updates. Starter is $19 only if you outgrow Free builds.", cell),
        ],
        [
            p("<b>SMS OTP</b>", cell),
            p("Charged when a buyer requests a code. Sessions persist.", cell),
            p("Per SMS", cell),
            p("Local +92 gateway. Planning figure <b>~$0.01 per OTP</b>. Real bill is PKR per SMS.", cell),
        ],
    ]

    totals = [
        header_row(
            ["Active users / month", "Monthly total", "What changed"],
            cell,
        ),
        [
            p("<b>1,000</b> (planning number)", cell),
            p("<b>$35</b><br/>Supabase $25 + SMS ~$10", cell),
            p("Resend still Free.", cell),
        ],
        [
            p("<b>3,000</b>", cell),
            p("<b>$55</b><br/>$25 + SMS ~$30", cell),
            p("Last month Resend stays Free (3,000 emails).", cell),
        ],
        [
            p("<b>5,000</b>", cell),
            p("<b>$95</b><br/>$25 + Resend $20 + SMS ~$50", cell),
            p("Over 3,000 emails/month or 100/day → Resend Pro $20. Extra emails $0.90 / 1,000.", cell),
        ],
        [
            p("<b>10,000</b>", cell),
            p("<b>$145</b><br/>$25 + $20 + SMS ~$100", cell),
            p("Same plans. SMS is most of the increase.", cell),
        ],
        [
            p("<b>50,000</b>", cell),
            p("<b>$545</b><br/>$25 + $20 + SMS ~$500", cell),
            p("Still inside Supabase Pro’s 100,000 MAU.", cell),
        ],
        [
            p("<b>100,000</b>", cell),
            p("<b>$1,045</b><br/>$25 + $20 + SMS ~$1,000", cell),
            p("Supabase Pro MAU cap. Next user is <b>$0.00325</b> (~$3.25 per 1,000 extra).", cell),
        ],
    ]

    accounts = [
        header_row(["Account / setting", "Dev now", "After store launch"], cell),
        [
            p("<b>Supabase</b>", cell),
            p("Free project, email+password", cell),
            p("Upgrade to Pro. Same project. Turn on Phone auth. Keep one email user for Apple review.", cell),
        ],
        [
            p("<b>EXPO_PUBLIC_AUTH_MODE</b>", cell),
            p("dev", cell),
            p("phone once the local SMS gateway is wired.", cell),
        ],
        [
            p("<b>allowed_users</b>", cell),
            p("Test emails", cell),
            p("Real +92 numbers. Invite stays admin-only.", cell),
        ],
        [
            p("<b>Resend</b>", cell),
            p("Test sender → your inbox only", cell),
            p("Verify SSG’s existing domain. Point RESEND_TO_EMAIL at the sales inbox.", cell),
        ],
        [
            p("<b>Expo / EAS</b>", cell),
            p("Expo Go / LAN", cell),
            p("Production store builds. Bake prod env into the EAS profile.", cell),
        ],
        [
            p("<b>Play / App Store</b>", cell),
            p("None", cell),
            p("New developer accounts and listings. Allowlist still gates login.", cell),
        ],
        [
            p("<b>Google Sheet</b>", cell),
            p("SSG Autos / SSG Orders", cell),
            p("Keep, or share a live SSG sheet with the same service account.", cell),
        ],
        [
            p("<b>SMS provider</b>", cell),
            p("None", cell),
            p("Local +92 gateway for login OTP.", cell),
        ],
    ]

    story += [
        table(one_time, [usable * 0.32, usable * 0.16, usable * 0.52]),
        Paragraph("2. Monthly cost and rate thresholds", heading),
        table(monthly, [usable * 0.16, usable * 0.30, usable * 0.14, usable * 0.40]),
        Paragraph(
            "Planning SMS = 1 OTP per active user per month at $0.01. "
            "Quote emails counted as 1 per active user. "
            "Add Apple $99 each year on top of the monthly total.",
            note,
        ),
        Paragraph("3. Total monthly by volume", heading),
        table(totals, [usable * 0.24, usable * 0.30, usable * 0.46]),
        Paragraph("4. Accounts that change at launch", heading),
        table(accounts, [usable * 0.22, usable * 0.28, usable * 0.50]),
        Paragraph(
            "Invite-only. No payments. Prices are vendor list rates and can change.",
            note,
        ),
        Spacer(1, 2 * mm),
        Paragraph("SSG Auto Parts  ·  Trusted since 1971", note),
    ]

    def on_page(canvas, doc_):
        canvas.saveState()
        canvas.setFillColor(RED)
        canvas.rect(0, A4[1] - 3.2 * mm, A4[0], 3.2 * mm, fill=1, stroke=0)
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 7)
        canvas.drawString(margin, 8 * mm, "Confidential — SSG Auto Parts store production estimate")
        canvas.drawRightString(A4[0] - margin, 8 * mm, f"Page {doc_.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
