import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

type Room = {
  id: string;
  name: string;
};

async function fetchRooms(): Promise<Room[]> {
  return [
    { id: '1', name: 'Design' },
    { id: '2', name: 'Engineering' },
  ];
}

async function createRoom(name: string): Promise<Room> {
  return { id: crypto.randomUUID(), name };
}

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const [name, setName] = useState('');

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: fetchRooms,
  });

  const createRoomMutation = useMutation({
    mutationFn: createRoom,
  });

  return (
    <main>
      <h1>Dashboard</h1>
      <section>
        <h2>Your rooms</h2>
        {roomsQuery.isPending ? <p>Loading rooms...</p> : null}
        <ul>
          {roomsQuery.data?.map((room) => (
            <li key={room.id}>{room.name}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Create room</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            createRoomMutation.mutate(name);
            setName('');
          }}
        >
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Room name" />
          <button type="submit">Create</button>
        </form>
      </section>
    </main>
  );
}
