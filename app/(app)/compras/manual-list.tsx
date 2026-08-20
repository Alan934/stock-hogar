"use client";

import {
  useActionState,
  useEffect,
  useOptimistic,
  useRef,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCopy, Eraser, NotebookPen, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import {
  addShoppingItemAction,
  clearDoneShoppingItemsAction,
  deleteShoppingItemAction,
  toggleShoppingItemAction,
} from "@/lib/actions/shopping";
import { IDLE } from "@/lib/actions/types";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  label: string;
  done: boolean;
  createdByName: string;
};

export function CopyListButton({ text }: { text: string }) {
  const { notify } = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      notify("Lista copiada, ya la podés pegar donde quieras.", "success");
    } catch {
      notify("No pudimos copiar la lista.", "error");
    }
  }

  return (
    <Button variant="secondary" onClick={copy}>
      <ClipboardCopy className="size-4" />
      Copiar lista
    </Button>
  );
}

export function ManualList({ items }: { items: Item[] }) {
  const [state, formAction] = useActionState(addShoppingItemAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef(state);
  const router = useRouter();
  const { notify } = useToast();

  const doneCount = items.filter((item) => item.done).length;

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;

    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    } else if (state.error) {
      notify(state.error, "error");
    }
  }, [state, notify, router]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-4.5 text-muted" />
        <h2 className="font-semibold">Anotado a mano</h2>
        {doneCount > 0 ? <ClearDoneButton count={doneCount} /> : null}
      </div>
      <p className="text-sm text-muted">
        Para lo que no se controla por stock: pilas, una lamparita, algo puntual
        para una receta. Lo puede anotar y tachar cualquiera de la familia.
      </p>

      <form ref={formRef} action={formAction} className="flex gap-2">
        <Input
          name="label"
          placeholder="Pilas AA"
          maxLength={120}
          required
          className="flex-1"
        />
        <SubmitButton className="px-4">
          <Plus className="size-4" />
          Anotar
        </SubmitButton>
      </form>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          Todavía no hay nada anotado.
        </p>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <ManualRow key={item.id} item={item} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

function ManualRow({ item }: { item: Item }) {
  const [pending, startTransition] = useTransition();
  // Tachar tiene que sentirse instantáneo aunque el servidor tarde.
  const [done, setDone] = useOptimistic(item.done);
  const router = useRouter();
  const { notify } = useToast();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) router.refresh();
      else notify(result.error ?? "No se pudo.", "error");
    });
  }

  function toggle() {
    startTransition(async () => {
      setDone(!item.done);
      const result = await toggleShoppingItemAction(item.id);
      if (result.ok) router.refresh();
      else notify(result.error ?? "No se pudo.", "error");
    });
  }

  return (
    <li className={cn("flex items-center gap-3 px-4 py-2.5", pending && "opacity-80")}>
      <button
        type="button"
        onClick={toggle}
        aria-label={done ? `Destachar ${item.label}` : `Tachar ${item.label}`}
        aria-pressed={done}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input hover:border-primary",
        )}
      >
        {done ? <Check className="size-4" /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", done && "text-muted line-through")}>
          {item.label}
        </p>
        <p className="text-xs text-muted">Lo anotó {item.createdByName}</p>
      </div>

      <button
        type="button"
        onClick={() => run(() => deleteShoppingItemAction(item.id))}
        aria-label={`Borrar ${item.label}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

function ClearDoneButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { notify } = useToast();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="ml-auto"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await clearDoneShoppingItemsAction();
          notify(
            result.ok ? (result.message ?? "Listo.") : (result.error ?? "Error"),
            result.ok ? "success" : "error",
          );
          if (result.ok) router.refresh();
        })
      }
    >
      <Eraser className="size-4" />
      Borrar tachados ({count})
    </Button>
  );
}
