# Model danych

## Zasady

1. Wszystkie dane współdzielone muszą posiadać `householdId`.
2. Identyfikatory powinny być UUID.
3. Rekordy powinny posiadać `createdAt` i `updatedAt`.
4. Dla danych usuwalnych warto rozważyć `deletedAt`.
5. Wartości odżywcze przechowuj jako `numeric(12,4)` i licz względem jawnej podstawy `per100g` albo `per100ml`.
6. Ilości przechowuj w jednostkach bazowych, gdy jest to możliwe.
7. Obliczenia żywieniowe wykonuj po stronie serwera.

## Tabele podstawowe

### users

- `id`
- `authProviderId`
- `email`
- `displayName`
- `avatarUrl`
- `createdAt`
- `updatedAt`

### userNutritionGoals

- `id`
- `userId`
- `kcalTarget`
- `proteinTarget`
- `carbsTarget`
- `fatTarget`
- `fiberTarget`

### households

- `id`
- `name`
- `ownerId`
- `createdAt`
- `updatedAt`

### householdMembers

- `id`
- `householdId`
- `userId`
- `role`
- `joinedAt`

Unikalność:

```text
householdId + userId
```

## Składniki i produkty

### ingredients

- `id`
- `householdId`
- `name`
- `description`
- `categoryId`
- `baseUnit`
- `nutritionBasis`
- `kcalPer100`
- `proteinPer100`
- `carbsPer100`
- `fatPer100`
- `fiberPer100`
- `saltPer100`
- `dataSource`
- `externalId`
- `importedAt`
- `sourceUpdatedAt`
- `verifiedByUser`
- `manuallyModified`
- `createdBy`
- `createdAt`
- `updatedAt`

### products

- `id`
- `householdId`
- `ingredientId`
- `name`
- `brand`
- `barcode`
- `packageQuantity`
- `packageUnit`
- `nutritionBasis`
- `kcalPer100`
- `proteinPer100`
- `carbsPer100`
- `fatPer100`
- `fiberPer100`
- `saltPer100`
- `dataSource`
- `externalId`
- `importedAt`
- `sourceUpdatedAt`
- `verifiedByUser`
- `manuallyModified`
- `imageUrl`
- `createdAt`
- `updatedAt`

### categories

- `id`
- `householdId`
- `name`
- `sortOrder`

### tags

- `id`
- `householdId`
- `name`
- `type`

### ingredientTags

- `ingredientId`
- `tagId`

### productTags

- `productId`
- `tagId`

## Przepisy

### recipes

- `id`
- `householdId`
- `name`
- `description`
- `instructions`
- `servings`
- `prepTimeMinutes`
- `cookTimeMinutes`
- `imageUrl`
- `createdBy`
- `createdAt`
- `updatedAt`

### recipeIngredients

- `id`
- `recipeId`
- `ingredientId`
- `productId`
- `quantity`
- `unit`
- `optional`
- `sortOrder`

Warunek:

- ustawiony jest `ingredientId` albo `productId`,
- nie oba jednocześnie, chyba że projekt świadomie obsługuje produkt jako preferowany wariant składnika.

### recipeTags

- `recipeId`
- `tagId`

### recipeNutritionSnapshots

Opcjonalne, jeżeli potrzebne jest zachowanie historycznych wartości.

- `id`
- `recipeId`
- `kcalTotal`
- `proteinTotal`
- `carbsTotal`
- `fatTotal`
- `fiberTotal`
- `calculatedAt`

## Planer

### mealPlanEntries

- `id`
- `householdId`
- `recipeId`
- `date`
- `mealType`
- `servings`
- `status`
- `notes`
- `createdBy`
- `createdAt`
- `updatedAt`

### mealPlanAssignments

- `id`
- `mealPlanEntryId`
- `userId`
- `servings`

Suma porcji przypisanych osobom nie powinna przekraczać liczby porcji wpisu bez świadomej obsługi nadwyżki.

## Zakupy

### shoppingLists

- `id`
- `householdId`
- `name`
- `dateFrom`
- `dateTo`
- `status`
- `createdAt`
- `updatedAt`

### shoppingListItems

- `id`
- `shoppingListId`
- `ingredientId`
- `productId`
- `name`
- `requestedQuantity`
- `pantryQuantity`
- `quantityToBuy`
- `unit`
- `categoryId`
- `source`
- `checked`
- `checkedBy`
- `checkedAt`
- `notes`

Pozycje ręczne muszą zachować się po regeneracji listy.

## Spiżarnia

### pantryItems

- `id`
- `householdId`
- `ingredientId`
- `productId`
- `quantity`
- `unit`
- `location`
- `expiresAt`
- `minimumQuantity`
- `updatedAt`

## Paragony

### receipts

- `id`
- `householdId`
- `uploadedBy`
- `storeName`
- `purchaseDate`
- `totalAmount`
- `currency`
- `imageUrl`
- `ocrStatus`
- `createdAt`

### receiptItems

- `id`
- `receiptId`
- `rawName`
- `normalizedName`
- `productId`
- `quantity`
- `unitPrice`
- `totalPrice`
- `confidence`

## Wydatki

### expenses

- `id`
- `householdId`
- `receiptId`
- `paidBy`
- `amount`
- `currency`
- `date`
- `description`

### expenseSplits

- `id`
- `expenseId`
- `userId`
- `amount`
- `status`

## Indeksy

Dodaj indeksy przynajmniej dla:

- `householdId`,
- `userId`,
- `date`,
- `recipeId`,
- `barcode`,
- `shoppingListId`,
- `receiptId`.

## Bezpieczeństwo

Każde zapytanie dotyczące danych household powinno sprawdzać członkostwo użytkownika.

Nie wystarczy filtrowanie po `householdId` przesłanym z frontendu.
