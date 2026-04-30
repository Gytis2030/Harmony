interface Props {
  params: { id: string }
}

export default function ProjectEditorPage({ params }: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">
        Project editor — ID: <code>{params.id}</code>
      </p>
    </main>
  )
}
