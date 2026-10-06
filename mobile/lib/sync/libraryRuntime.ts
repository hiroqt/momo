import { localDb } from '../storage/localDb';
import { LibraryActions } from './libraryActions';
import { mutationQueue } from './mutationQueue';

export const libraryActions = new LibraryActions(localDb, mutationQueue);
