'use client';

import { useState } from 'react';
import { GameRecord } from './games-list';
import GamesList from './games-list';

export default function GamesListClient({ initialGames, initialTotalPages, page }: {
  initialGames: GameRecord[];
  initialTotalPages: number;
  page: number;
}) {
  const [currentPage, setCurrentPage] = useState(page);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    // 直接跳转刷新页面
    window.location.href = `/admin/games?page=${newPage}`;
  };

  return (
    <GamesList
      games={initialGames}
      totalPages={initialTotalPages}
      currentPage={currentPage}
      onPageChange={handlePageChange}
    />
  );
}
