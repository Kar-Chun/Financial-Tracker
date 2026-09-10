begin;

create function public.get_transaction_note_suggestions(
  p_query text,
  p_transaction_type text,
  p_limit integer default 3
)
returns table (
  note text,
  category_id uuid,
  category_name text,
  category_label text,
  usage_count bigint,
  last_used_on date,
  last_used_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_query text := pg_catalog.lower(
    pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_query, '')), '[[:space:]]+', ' ', 'g')
  );
  v_limit integer := least(greatest(coalesce(p_limit, 3), 1), 3);
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_transaction_type is null or p_transaction_type not in ('expense', 'income') then
    raise exception using errcode = '22023', message = 'Note suggestions support only expense or income transactions.';
  end if;

  if pg_catalog.char_length(pg_catalog.regexp_replace(v_query, '[[:space:]]', '', 'g')) < 2 then
    return;
  end if;

  if pg_catalog.char_length(v_query) > 500 then
    raise exception using errcode = '22023', message = 'Note suggestion query is too long.';
  end if;

  return query
  with matching as materialized (
    select
      transaction_record.id,
      pg_catalog.btrim(transaction_record.description) as display_note,
      pg_catalog.lower(
        pg_catalog.regexp_replace(pg_catalog.btrim(transaction_record.description), '[[:space:]]+', ' ', 'g')
      ) as normalized_note,
      transaction_record.category_id,
      transaction_record.transaction_date,
      transaction_record.created_at,
      case
        when pg_catalog.left(
          pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(transaction_record.description), '[[:space:]]+', ' ', 'g')),
          pg_catalog.char_length(v_query)
        ) = v_query then 1
        when exists (
          select 1
          from pg_catalog.regexp_split_to_table(
            pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(transaction_record.description), '[[:space:]]+', ' ', 'g')),
            '[^[:alnum:]]+'
          ) as words(word)
          where pg_catalog.left(words.word, pg_catalog.char_length(v_query)) = v_query
        ) then 2
        else 3
      end as match_rank
    from public.transactions transaction_record
    where transaction_record.user_id = v_user_id
      and transaction_record.transaction_type = p_transaction_type
      and transaction_record.deleted_at is null
      and transaction_record.description is not null
      and pg_catalog.btrim(transaction_record.description) <> ''
      and pg_catalog.strpos(
        pg_catalog.lower(
          pg_catalog.regexp_replace(pg_catalog.btrim(transaction_record.description), '[[:space:]]+', ' ', 'g')
        ),
        v_query
      ) > 0
  ), summaries as (
    select
      matching.normalized_note,
      pg_catalog.min(matching.match_rank) as match_rank,
      pg_catalog.count(*)::bigint as usage_count,
      pg_catalog.max(matching.transaction_date) as last_used_on
    from matching
    group by matching.normalized_note
  )
  select
    display_choice.display_note as note,
    category_choice.category_id,
    category_choice.category_name,
    category_choice.category_label,
    summary.usage_count,
    summary.last_used_on,
    display_choice.created_at as last_used_at
  from summaries summary
  cross join lateral (
    select
      recent_match.display_note,
      recent_match.created_at
    from matching recent_match
    where recent_match.normalized_note = summary.normalized_note
    order by recent_match.transaction_date desc, recent_match.created_at desc, recent_match.id desc
    limit 1
  ) display_choice
  left join lateral (
    select
      category.id as category_id,
      category.name as category_name,
      coalesce(parent.name || ' › ' || category.name, category.name) as category_label
    from matching category_match
    join public.categories category
      on category.id = category_match.category_id
      and category.user_id = v_user_id
      and category.category_type = p_transaction_type
      and category.archived_at is null
    left join public.categories parent
      on parent.id = category.parent_id
      and parent.user_id = v_user_id
    where category_match.normalized_note = summary.normalized_note
    order by category_match.transaction_date desc, category_match.created_at desc, category_match.id desc
    limit 1
  ) category_choice on true
  order by
    summary.match_rank,
    summary.usage_count desc,
    summary.last_used_on desc,
    display_choice.created_at desc,
    summary.normalized_note
  limit v_limit;
end;
$$;

revoke all on function public.get_transaction_note_suggestions(text, text, integer)
  from public, anon;
grant execute on function public.get_transaction_note_suggestions(text, text, integer)
  to authenticated;

commit;
