import mongoose,{Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema({
    videoFile:{
        type:String,
        required:[true,"required"]
    },
    thumbnail:{
        type:String,
        required:[true,"Thumbnail required"]
    },
    title:{
        type:String,
        required:[true,"Title is required "]
    },
    description:{
        type:String,
        required:[true,"Please enter description "]
    },
    duration:{
        type:Number, //from cloudinary
        required:[true,"duration required "]
    },
    views:{
        typer:Number,
        default:0
    },
    isPublished:{
        type:Boolean,
        default:true
    },
    owner:{
        type:Schema.Types.ObjectId,
        ref:"User"
    }

},{timestamps:true});

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video",videoSchema);
