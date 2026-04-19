import { Resvg } from "@resvg/resvg-js";
import type { APIRoute } from "astro";
import satori from "satori";

async function loadGoogleFont(
	family: string,
	weight: number,
): Promise<ArrayBuffer> {
	const css = await fetch(
		`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
		{
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
			},
		},
	).then((r) => r.text());
	const url = css.match(/src: url\((.+?)\) format/)?.[1];
	if (!url) throw new Error(`Font URL not found: ${family}:${weight}`);
	return fetch(url).then((r) => r.arrayBuffer());
}

export const GET: APIRoute = async () => {
	const [regular, bold] = await Promise.all([
		loadGoogleFont("Inter", 400),
		loadGoogleFont("Inter", 700),
	]);

	const badge = (text: string, bg: string, color: string) => ({
		type: "div",
		props: {
			style: {
				display: "flex",
				background: bg,
				color,
				padding: "6px 20px",
				borderRadius: "9999px",
				fontSize: "22px",
				fontWeight: 700,
			},
			children: text,
		},
	});

	const svg = await satori(
		{
			type: "div",
			props: {
				style: {
					width: "100%",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					padding: "80px",
					background: "#111827",
					fontFamily: "Inter",
				},
				children: [
					{
						type: "div",
						props: {
							style: { display: "flex", gap: "12px", marginBottom: "40px" },
							children: [
								badge("OpenAI", "#d1fae5", "#065f46"),
								badge("Claude", "#ede9fe", "#5b21b6"),
								badge("Cursor", "#dbeafe", "#1e40af"),
							],
						},
					},
					{
						type: "div",
						props: {
							style: {
								display: "flex",
								fontSize: "88px",
								fontWeight: 700,
								color: "#ffffff",
								lineHeight: 1.1,
								marginBottom: "28px",
							},
							children: "AI Tech Feeds",
						},
					},
					{
						type: "div",
						props: {
							style: {
								display: "flex",
								fontSize: "34px",
								color: "#9ca3af",
								fontWeight: 400,
							},
							children: "Daily AI tech blog feeds from OpenAI, Claude & Cursor",
						},
					},
				],
			},
		},
		{
			width: 1200,
			height: 630,
			fonts: [
				{ name: "Inter", data: regular, weight: 400, style: "normal" },
				{ name: "Inter", data: bold, weight: 700, style: "normal" },
			],
		},
	);

	const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } })
		.render()
		.asPng();

	return new Response(png, { headers: { "Content-Type": "image/png" } });
};
