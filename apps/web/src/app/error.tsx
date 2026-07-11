"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants, Card, Container, Section } from "@repo/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Section>
      <Container>
        <Card className="flex flex-col items-start gap-md">
          <div>
            <h2>Something went wrong.</h2>
            <p className="text-muted-foreground">
              An unexpected error interrupted this page. You can try again, or head back to the
              homepage.
            </p>
          </div>
          <div className="flex gap-sm">
            <Button type="button" onClick={reset}>
              Try again
            </Button>
            <Link href="/" className={buttonVariants({ variant: "secondary" })}>
              Go home
            </Link>
          </div>
        </Card>
      </Container>
    </Section>
  );
}
