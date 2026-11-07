import { it, expect } from "vitest";
import { pickAttraction, normalizeName } from "../src/resolve";

const music = (id: string, name: string, upcomingEvents: number) => ({ id, name, upcomingEvents, segment: "Music" });

it("elige la coincidencia exacta frente a tributos", () =>
  expect(pickAttraction("Oasis", [music("A", "Oasis", 52), music("B", "Oasis Tribute", 3)])).toEqual({ id: "A" }));

it("descarta candidatos que no son de música", () =>
  expect(pickAttraction("Muse", [{ id: "M", name: "Muse", upcomingEvents: 4, segment: "Arts & Theatre" }])).toEqual({
    unresolved: "Muse",
  }));

it("ignora mayúsculas, acentos y signos", () => {
  expect(pickAttraction("Rosalía", [music("R", "ROSALÍA", 10)])).toEqual({ id: "R" });
  expect(pickAttraction("P!nk", [music("P", "P!NK", 10)])).toEqual({ id: "P" });
  expect(pickAttraction("Guns N' Roses", [music("G", "Guns N Roses", 10)])).toEqual({ id: "G" });
});

it("ignora el artículo inicial 'The'", () =>
  expect(pickAttraction("The Weeknd", [music("W", "Weeknd", 5)])).toEqual({ id: "W" }));

it("empate de nombre → el que tiene más eventos próximos", () =>
  expect(pickAttraction("Feid", [music("F1", "Feid", 2), music("F2", "FEID", 30)])).toEqual({ id: "F2" }));

it("sin coincidencia exacta → sin resolver (no se adivina)", () =>
  expect(pickAttraction("Leiva", [music("L", "Leiva y amigos", 2)])).toEqual({ unresolved: "Leiva" }));

it("normalizeName", () => expect(normalizeName("Florence + The Machine")).toBe("florencethemachine"));
