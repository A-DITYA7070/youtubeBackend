import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async(userId) => {
    try{
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave:false});

        return {accessToken,refreshToken};

    }catch(err){
        throw new ApiError(500,"something went wrong while generating refresh and access token ")
    }
}

/**
 * User controller to register user 
 */
const registerUser = asyncHandler( async(req,res) => {
    const {
        fullname,
        username,
        email,
        password
    } = req.body;
    if([fullname,email,username,password].some((field)=>field?.trim() === "")){
        throw new ApiError(400,"All fields are required ")
    }
    
    const existingUser = await User.findOne({
        $or:[{username},{email}]
    });

    if(existingUser){
        throw new ApiError(409,"User already exists ");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0]?.path
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required ")
    }
    
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
     
    if(!avatar){
        throw new ApiError(400,"Avatar file is required ");
    }
    
    const user = await User.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    if(!createdUser){
        throw new ApiError(500,"Internal server error ")
    }
    
    return res.status(201).json(new ApiResponse(201,createdUser,"User registered successfully"))
});


/**
 *  User controller to login 
 */
const loginUser = asyncHandler(async(req,res) => {
    const {
        email,
        username,
        password
    } = req.body;
    if(!username || !email && !password){
        throw new ApiError(400,"username or password is required ")
    }
    
    const user = await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User doesn't exists ")
    }

    const isValidPassword = await user.isPasswordCorrect(password);
    if(!isValidPassword){
        throw new ApiError(401,"Invalid user credentials ")
    }
    
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options ={
        httpOnly:true,
        secure:true
    }
    
    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(new ApiResponse(200,{
        user:loggedInUser,
        accessToken,
        refreshToken
      },"User logged in successfully !! "
    ))

})

const logoutUser = asyncHandler( async(req,res) => {
    await User.findByIdAndUpdate(req.user._id,{
        $set:{
            refreshToken:undefined
        }
    },
    {
        new:true
    })

    const options = {
        httpOnly:true,
        secure:true
    }

    return res.
    status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged out successfully !! "))

})

const refreshAccessToken = asyncHandler(async (req,res)=>{
    const incomingRefreshToken = req.cookies.refeshToken || req.body.refeshToken;
    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorised Request !!")
    }
    try{
        const decodedToken = jwt.verify(
            incomingRefreshToken | undefined,
            process.env.REFRESH_ACCESS_TOKEN
        )
    
        const user =  await User.findById(decodedToken?._id);
        if(!user){
            throw new ApiError(401,"Unauthorised Request !! ")
        }
    
        if(incomingRefreshToken !== user?.refeshToken){
            throw new ApiError(401,"Refresh token expired ")
        }
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id);
        
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(new ApiResponse(
            200,
            {accessToken,newRefreshToken},
            "Access Token refreshed successfully!!"
        ))
    }catch(err){
        throw new ApiError(401,err?.message || "Unauthorised request ");
    }
});

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body;
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect){
        throw new ApiError(400,err?.message || "Invalid credentials ");
    }

    user.password = newPassword;
    user.save({validateBeforeSave:false});
    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed !! "));
});

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(200,req.user,"current user fetched successfully !! ");
});

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullname,email} = req.body;
    if(!fullname || !email){
        throw new ApiError(400,"All fields are required !! ")
    }

    const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
        $set:{
            fullname:fullname,
            email:email
        }

    },
    {
        new:true
    }).select("-password");

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account updated Successfully !!"));

});

const updateUserAvatarImage = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath){
       throw new ApiError(400,"Avatar file is missing ")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.url){
        throw new ApiError(400,'Error while uploading on avatar ')
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {
            new:true
        }
    ).select("-password");
    return res
    .status(200)
    .json(new ApiResponse(200,user,"Avatar Image updated successfully !! "));
});

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverLocalPath = req.file?.path;
    if(!coverLocalPath){
       throw new ApiError(400,"Avatar file is missing ")
    }
    const coverImage = await uploadOnCloudinary(coverLocalPath);
    if(!coverImage.url){
        throw new ApiError(400,'Error while uploading cover image ')
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {
            new:true
        }
    ).select("-password");
    return res
    .status(200)
    .json(new ApiResponse(200,user,"Cover Image updated successfully !! "));
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    updateAccountDetails,
    getCurrentUser,
    updateUserAvatarImage,
    updateUserCoverImage
}