"use server";

import { revalidatePath } from "next/cache";

export async function revalidateRoom(roomId: string): Promise<void> {
  console.log(`🔄 清除房间缓存: ${roomId}`);
  revalidatePath(`/lobby/${roomId}`);
}
