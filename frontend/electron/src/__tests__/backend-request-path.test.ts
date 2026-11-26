import { describe, it, expect } from "vitest";
import { backendRequestPath } from "../backend-request-path.js";

const pathFor = (path: string) =>
  backendRequestPath(new URL(`vectora-app://app${path}`));

describe("backendRequestPath", () => {
  it("preserva a barra final da listagem de planos", () => {
    expect(pathFor("/artifacts/?session_id=thread-1")).toBe(
      "/artifacts/?session_id=thread-1",
    );
  });

  it("não acrescenta barra a rotas sem ela nem à raiz", () => {
    expect(pathFor("/artifacts/plano?session_id=thread-1")).toBe(
      "/artifacts/plano?session_id=thread-1",
    );
    expect(pathFor("/")).toBe("/");
  });

  it("normaliza barras repetidas sem produzir um host", () => {
    expect(pathFor("//evil.example//x/")).toBe("/evil.example/x/");
  });

  it("recusa segmentos que sobem de diretório", () => {
    expect(() =>
      backendRequestPath({ pathname: "/a/%2E%2E", search: "" } as URL),
    ).toThrow("Caminho inválido");
  });
});
