-- A named meal with no recipe behind it ("Tacos"). Kept in its own migration:
-- a new enum value cannot be used in the transaction that adds it.
alter type plan_entry_kind add value if not exists 'meal';
