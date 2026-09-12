"use client";

import { useRouter } from "next/navigation";
import { deleteEditor } from "@/app/actions";

export function DeleteEditorButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  return (
    <form
      action={async (fd) => {
        await deleteEditor(fd);
        router.refresh();
      }}
      onSubmit={(e) => {
        if (
          !confirm(
            `Permanently delete ${name}? This erases their account and ALL credits, flags, and history. This cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="user_id" value={userId} />
      <button className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50">
        Delete permanently
      </button>
    </form>
  );
}
