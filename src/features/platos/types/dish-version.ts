export interface DishVersion {
  id: string;
  dishId: string;
  versionNumber: number;
  name: string;
  price: number;
  createdAt: string;
}

export interface CreateDishVersionInput {
  name: string;
  price: number;
}
