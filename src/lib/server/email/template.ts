// Table layout + inline styles only, Outlook does not do flex/grid/web fonts

import { C } from './colors';

export type EmailPick = { name: string; url: string; imageUrl: string; score: number; why: string };

export type EmailInput = {
	picks: EmailPick[];
	unsubscribeUrl: string;
	signedUpAt: Date;
	submittedUrl: string;
};

const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const esc = (s: string) =>
	s
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');

// only http(s) links go in the mail, anything else is dropped
const safe = (u: string) => (/^https?:\/\//i.test(u) ? esc(u) : '');

const fmtDate = (d: Date) =>
	d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function card(p: EmailPick, i: number): string {
	const img = safe(p.imageUrl)
		? `<img src="${safe(p.imageUrl)}" width="88" height="88" alt="${esc(p.name)} cover art" style="display:block;border:2px solid ${C.ink};border-radius:12px;">`
		: '';
	return `<tr><td style="padding:0 0 16px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.white};border:2px solid ${C.ink};border-radius:16px;"><tr>
<td width="88" valign="top" style="padding:16px 0 16px 16px;">${img}</td>
<td valign="top" style="padding:16px;font-family:${FONT};color:${C.ink};">
<span style="display:inline-block;background:${C.butter};border:2px solid ${C.ink};border-radius:999px;padding:2px 10px;font-size:12px;font-weight:800;">${p.score}% match</span>
<div style="font-size:18px;font-weight:800;line-height:1.25;padding:8px 0 6px 0;"><a href="${safe(p.url)}" style="color:${C.ink};text-decoration:none;">${i + 1}. ${esc(p.name)}</a></div>
<div style="font-size:14px;line-height:1.5;color:${C.mutedText};">${esc(p.why)}</div>
</td></tr></table></td></tr>`;
}

export function buildEmail(input: EmailInput) {
	const { picks, unsubscribeUrl, signedUpAt, submittedUrl } = input;
	const subject = `Your ${picks.length} podcast matches from PodMatch`;
	const unsub = safe(unsubscribeUrl);

	const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.cream};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.cream}" style="background:${C.cream};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="font-family:${FONT};color:${C.ink};padding:0 0 20px 0;">
<div style="font-size:14px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${C.coral};">PodMatch</div>
<div style="font-size:26px;font-weight:800;line-height:1.2;padding-top:6px;">Shows you will actually binge</div>
<div style="font-size:14px;line-height:1.5;color:${C.mutedText};padding-top:8px;">All 90%+ matches, built from ${esc(submittedUrl)}.</div>
</td></tr>
${picks.map(card).join('\n')}
<tr><td style="font-family:${FONT};font-size:12px;line-height:1.6;color:${C.mutedText};padding:12px 0 0 0;border-top:1px solid ${C.muted};">
You are getting this because you asked PodMatch for podcast picks on ${fmtDate(signedUpAt)}, and we send a fresh list every week.<br>
<a href="${unsub}" style="color:${C.mutedText};text-decoration:underline;">Unsubscribe</a> any time - one click.
</td></tr>
</table></td></tr></table></body></html>`;

	const text = [
		'PodMatch - shows you will actually binge',
		`All 90%+ matches, built from ${submittedUrl}.`,
		'',
		...picks.map((p, i) => `${i + 1}. ${p.name} (${p.score}% match)\n   ${p.why}\n   ${p.url}`),
		'',
		`You are getting this because you asked PodMatch for podcast picks on ${fmtDate(signedUpAt)}, and we send a fresh list every week.`,
		`Unsubscribe: ${unsubscribeUrl}`
	].join('\n');

	return { subject, html, text };
}
