"use client";

interface DeleteMeetButtonProps {
    meetLabel: string;
}

export default function DeleteMeetButton({ meetLabel }: DeleteMeetButtonProps) {
    return (
        <button
            type="submit"
            className="secondary"
            style={{ fontSize: "0.85rem", padding: "6px 12px" }}
            onClick={(e) => {
                if (!confirm(`「${meetLabel}」を削除しますか？関連する全ての記録も削除されます。`)) {
                    e.preventDefault();
                }
            }}
        >
            削除
        </button>
    );
}
