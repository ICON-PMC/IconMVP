"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { RatingRow, RatingSort } from "@/lib/ratings";
import { loadMoreRatings } from "@/app/(app)/marca/[slug]/ratings-actions";
import { RatingItemClient } from "./rating-item-client";

/** Lista con "Ver más" por tandas de 10 (spec 011, FR-006). */
export function RatingList({
  brandId,
  sort,
  stars,
  initial,
  initialNext,
  myId,
  isLoggedIn,
}: {
  brandId: string;
  sort: RatingSort;
  stars: number | null;
  initial: RatingRow[];
  initialNext: number | null;
  myId: string | null;
  isLoggedIn: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [next, setNext] = useState(initialNext);
  const [pending, start] = useTransition();
  return (
    <div>
      <ul className="surface px-5">
        {items.map((r) => (
          <RatingItemClient key={r.id} rating={r} canReport={isLoggedIn && r.author.id !== myId} />
        ))}
      </ul>
      {next != null && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await loadMoreRatings(brandId, sort, stars, next);
                setItems((prev) => [...prev, ...res.items.filter((x) => !prev.some((p) => p.id === x.id))]);
                setNext(res.nextOffset);
              })
            }
          >
            Ver más reseñas
          </Button>
        </div>
      )}
    </div>
  );
}
