import { ImageResponse } from "next/og";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params;
  const dimension = Number(size) || 192;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          color: "#fafafa",
          fontSize: dimension * 0.45,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        OT
      </div>
    ),
    { width: dimension, height: dimension }
  );
}
