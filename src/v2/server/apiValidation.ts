export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export function notFound() {
  return Response.json({ error: "not_found" }, { status: 404 });
}
