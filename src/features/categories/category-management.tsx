import { zodResolver } from "@hookform/resolvers/zod"
import { Archive, ArchiveRestore, LoaderCircle, Pencil, Plus, Tags } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/auth-context"
import { useSaveCategory, useSetCategoryArchived } from "@/features/categories/categories-hooks"
import {
  validateCategoryArchive,
  validateCategoryDraft,
  validateCategoryRestore,
  type CategoryType,
} from "@/features/categories/category-logic"
import { useCategories } from "@/features/transactions/transactions-hooks"
import { getCategoryDisplayName } from "@/features/transactions/transaction-logic"
import { getErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import type { Category } from "@/types/database"

type CategoryDialogState = {
  categoryType: CategoryType
  parentId: string | null
  category?: Category
}

export function CategoryManagement() {
  const { user } = useAuth()
  const categoriesQuery = useCategories()
  const archiveMutation = useSetCategoryArchived()
  const [type, setType] = useState<CategoryType>("expense")
  const [dialog, setDialog] = useState<CategoryDialogState | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Category | null>(null)
  const categories = categoriesQuery.data ?? []
  const active = categories.filter((category) => category.category_type === type && category.archived_at === null)
  const archived = categories.filter((category) => category.category_type === type && category.archived_at !== null)
  const roots = active.filter((category) => !category.parent_id).sort(byName)

  const changeArchivedState = (category: Category, shouldArchive: boolean) => {
    if (!user) return
    try {
      if (shouldArchive) validateCategoryArchive(category, categories, user.id)
      else validateCategoryRestore(category, categories, user.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The category state could not be changed.")
      return
    }
    archiveMutation.mutate({ categoryId: category.id, archived: shouldArchive }, {
      onSuccess: () => {
        toast.success(shouldArchive ? "Category archived." : "Category restored.")
        setArchiveTarget(null)
      },
      onError: (error) => toast.error(getErrorMessage(error, "The category state could not be changed.")),
    })
  }

  return (
    <Card className="border-0 bg-card/55 shadow-none ring-1 ring-white/4">
      <CardHeader className="border-b border-border/25">
        <CardTitle className="flex items-center gap-2"><Tags className="size-4" /> Categories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex rounded-xl bg-surface p-1 ring-1 ring-border/25">
          {(["expense", "income"] as const).map((categoryType) => (
            <button
              key={categoryType}
              type="button"
              onClick={() => setType(categoryType)}
              className={cn("flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize text-muted-foreground transition-colors", type === categoryType && "bg-primary text-primary-foreground")}
            >
              {categoryType} Categories
            </button>
          ))}
        </div>

        {categoriesQuery.isLoading ? <Skeleton className="h-56 rounded-xl" /> : categoriesQuery.isError ? (
          <p className="rounded-lg border border-destructive/30 p-4 text-sm">Categories could not be loaded.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-medium capitalize">{type} categories</h3>
                <p className="text-xs text-muted-foreground">One parent level keeps transaction entry quick and predictable.</p>
              </div>
              <Button size="sm" onClick={() => setDialog({ categoryType: type, parentId: null })}><Plus /> Add Category</Button>
            </div>

            {roots.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">No active {type} categories.</div>
            ) : (
              <div className="space-y-2">
                {roots.map((root) => (
                  <CategoryRow
                    key={root.id}
                    category={root}
                    subcategories={active.filter((category) => category.parent_id === root.id).sort(byName)}
                    onAddChild={() => setDialog({ categoryType: type, parentId: root.id })}
                    onRename={(category) => setDialog({ categoryType: type, parentId: category.parent_id, category })}
                    onArchive={setArchiveTarget}
                  />
                ))}
              </div>
            )}

            {archived.length > 0 && (
              <section className="border-t pt-5">
                <h3 className="text-sm font-medium">Archived</h3>
                <p className="mt-1 text-xs text-muted-foreground">Archived categories remain attached to historical transactions.</p>
                <div className="mt-3 space-y-2">
                  {archived.sort(byName).map((category) => (
                    <div key={category.id} className="flex items-center justify-between gap-4 rounded-xl bg-surface px-3 py-2.5 ring-1 ring-border/20">
                      <span className="text-sm text-muted-foreground">{getCategoryDisplayName(category, categories)}</span>
                      <Button variant="ghost" size="sm" disabled={archiveMutation.isPending} onClick={() => changeArchivedState(category, false)}><ArchiveRestore /> Restore</Button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </CardContent>

      <CategoryFormDialog state={dialog} categories={categories} userId={user?.id ?? ""} onOpenChange={(open) => !open && setDialog(null)} />

      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {archiveTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>It will no longer be available for new transactions, but historical transactions will keep this category.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={archiveMutation.isPending} onClick={(event) => { event.preventDefault(); if (archiveTarget) changeArchivedState(archiveTarget, true) }}>
              {archiveMutation.isPending && <LoaderCircle className="animate-spin" />} Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function CategoryRow({ category, subcategories, onAddChild, onRename, onArchive }: {
  category: Category
  subcategories: Category[]
  onAddChild: () => void
  onRename: (category: Category) => void
  onArchive: (category: Category) => void
}) {
  return (
    <div className="rounded-xl bg-surface/80 ring-1 ring-border/20">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <span className="font-medium">{category.name}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onAddChild}><Plus /> Subcategory</Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Rename ${category.name}`} onClick={() => onRename(category)}><Pencil /></Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Archive ${category.name}`} onClick={() => onArchive(category)}><Archive /></Button>
        </div>
      </div>
      {subcategories.length > 0 && (
        <div className="border-t border-border/25 px-3 py-2">
          {subcategories.map((child) => (
            <div key={child.id} className="flex items-center justify-between gap-4 border-l border-primary/30 py-2 pl-4">
              <span className="text-sm text-muted-foreground">{child.name}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Rename ${child.name}`} onClick={() => onRename(child)}><Pencil /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Archive ${child.name}`} onClick={() => onArchive(child)}><Archive /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const categorySchema = z.object({ name: z.string().trim().min(1, "Category name is required.").max(100, "Category name is too long.") })
type CategoryFormValues = z.infer<typeof categorySchema>

function CategoryFormDialog({ state, categories, userId, onOpenChange }: { state: CategoryDialogState | null; categories: Category[]; userId: string; onOpenChange: (open: boolean) => void }) {
  const mutation = useSaveCategory()
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<CategoryFormValues>({ resolver: zodResolver(categorySchema), defaultValues: { name: "" } })
  const parent = state?.parentId ? categories.find((category) => category.id === state.parentId) : null

  useEffect(() => { if (state) reset({ name: state.category?.name ?? "" }) }, [reset, state])

  const onSubmit = (values: CategoryFormValues) => {
    if (!state || !userId) return
    let name: string
    try {
      name = validateCategoryDraft({ name: values.name, type: state.categoryType, parentId: state.parentId, categoryId: state.category?.id, categories, userId })
    } catch (error) {
      setError("name", { message: error instanceof Error ? error.message : "Category details are invalid." })
      return
    }
    mutation.mutate({ name, categoryType: state.categoryType, parentId: state.parentId, categoryId: state.category?.id }, {
      onSuccess: () => { toast.success(state.category ? "Category renamed." : "Category created."); onOpenChange(false) },
      onError: (error) => setError("name", { message: getErrorMessage(error, "The category could not be saved.") }),
    })
  }

  return (
    <Dialog open={Boolean(state)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{state?.category ? "Rename category" : state?.parentId ? "Add subcategory" : "Add category"}</DialogTitle>
          <DialogDescription>{parent ? `This will appear under ${parent.name}.` : `Create an ${state?.categoryType ?? "expense"} category.`}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2"><Label htmlFor="category-name">Name</Label><Input id="category-name" autoFocus {...register("name")} />{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="animate-spin" />}{state?.category ? "Save name" : "Create category"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function byName(left: Category, right: Category) {
  return left.name.localeCompare(right.name)
}
