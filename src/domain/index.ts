import { AuthController } from './auth';
import { PostsController } from './posts';
import { CategoriesController } from './posts/categories';

export const Router = [AuthController, PostsController, CategoriesController];
