export interface User {
  id: number;
  username: string;
  display_name: string;
  bio: string | null;
  profile_picture: string | null;
  join_date: string;
}

export interface Post {
  id: number;
  content: string;
  timestamp: string;
  author: {
    id: number;
    username: string;
    display_name: string;
    profile_picture: string | null;
  };
  like_count: number;
  comment_count: number;
  is_liked: boolean;
}

export interface Comment {
  id: number;
  content: string;
  timestamp: string;
  author: {
    id: number;
    username: string;
    display_name: string;
    profile_picture: string | null;
  };
}

export interface Profile {
  id: number;
  username: string;
  display_name: string;
  bio: string | null;
  profile_picture: string | null;
  join_date: string;
  followers_count: number;
  following_count: number;
  is_following: boolean;
}
