import { HttpClient, HttpParams } from "@angular/common/http";
import { EMPTY, expand, map, reduce } from "rxjs";
import { record, ReceptionError } from "./reception-api";

/** The items envelope was observed on appointment and today-session GET responses. */
export function pagedRecords<T>(
  http: HttpClient,
  url: string,
  decode: (value: unknown) => T,
  params = new HttpParams(),
) {
  const page = (n: number) =>
    http
      .get<unknown>(url, {
        params: params.set("PageNumber", n).set("PageSize", 100),
      })
      .pipe(
        map((value) => {
          const r = record(value);
          if (
            !Array.isArray(r["items"]) ||
            typeof r["hasNextPage"] !== "boolean"
          )
            throw new ReceptionError(
              "RESPONSE_CONTRACT_PENDING",
              "The paginated response needs verification.",
            );
          return {
            items: r["items"].map(decode),
            next: r["hasNextPage"],
            current: n,
            total: Number(r["totalPages"]),
          };
        }),
      );
  return page(1).pipe(
    expand((p) => {
      if (!p.next) return EMPTY;
      if (!Number.isInteger(p.total) || p.total <= p.current)
        throw new ReceptionError(
          "RESPONSE_CONTRACT_PENDING",
          "The paginated response needs verification.",
        );
      return page(p.current + 1);
    }),
    map((p) => p.items),
    reduce((all, items) => [...all, ...items], [] as T[]),
  );
}
